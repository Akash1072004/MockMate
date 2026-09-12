import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Executes a child process with input and timeout protection.
 * On Windows, force kills process tree via taskkill if timed out.
 */
function runProcess({ command, args, cwd, input = '', timeoutMs = 5000, maxBuffer = 512 * 1024 }) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let finished = false;

    let child;
    try {
      child = spawn(command, args, {
        cwd,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      return resolve({
        exitCode: 1,
        stdout: '',
        stderr: err.message || 'Failed to spawn process',
        timedOut: false,
        durationMs: Date.now() - startTime,
      });
    }

    const timer = setTimeout(() => {
      timedOut = true;
      if (!finished) {
        if (process.platform === 'win32') {
          try {
            spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
          } catch (e) {
            child.kill('SIGKILL');
          }
        } else {
          child.kill('SIGKILL');
        }
      }
    }, timeoutMs);

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        if (stdout.length < maxBuffer) {
          stdout += chunk.toString();
        }
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        if (stderr.length < maxBuffer) {
          stderr += chunk.toString();
        }
      });
    }

    if (child.stdin) {
      try {
        if (input) {
          child.stdin.write(input);
        }
        child.stdin.end();
      } catch (e) {
        // Stdin already closed
      }
    }

    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr || err.message,
        timedOut,
        durationMs: Date.now() - startTime,
      });
    });

    child.on('close', (exitCode) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        exitCode: timedOut ? null : (exitCode ?? 0),
        stdout,
        stderr,
        timedOut,
        durationMs: Date.now() - startTime,
      });
    });
  });
}

/**
 * Strips local system temp directory paths from error messages
 * to provide clean, professional compiler and runtime outputs.
 */
function sanitizeOutput(text, tempDir) {
  if (!text) return '';
  const escaped = tempDir.replace(/\\/g, '\\\\');
  const regex = new RegExp(escaped, 'gi');
  return text.replace(regex, '.').replace(/[A-Za-z]:\\[^:\n\r]+[\\/]/g, '');
}

/**
 * Main service method to compile and execute code across Python, C++, and Java.
 */
export async function executeCode({ language, code, testCases = [], customInput = null, timeoutMs = 5000 }) {
  if (!code || typeof code !== 'string') {
    return {
      success: false,
      verdict: 'CE',
      passedCount: 0,
      totalCount: 0,
      executionTimeMs: 0,
      output: '',
      error: 'Code cannot be empty',
      testResults: [],
    };
  }

  const normalizedLang = (language || 'python').toLowerCase().trim();
  const execDir = path.join(os.tmpdir(), `mm_exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  try {
    fs.mkdirSync(execDir, { recursive: true });

    let runCommand = '';
    let runArgs = [];
    let compilationError = null;

    // 1. Language Compilation & Setup
    if (normalizedLang === 'python' || normalizedLang === 'py') {
      const filePath = path.join(execDir, 'solution.py');
      fs.writeFileSync(filePath, code, 'utf8');
      runCommand = 'python';
      runArgs = ['solution.py'];

    } else if (normalizedLang === 'cpp' || normalizedLang === 'c++') {
      const sourceFile = path.join(execDir, 'solution.cpp');
      const exeFile = path.join(execDir, 'solution.exe');
      fs.writeFileSync(sourceFile, code, 'utf8');

      // Compile C++
      const compileResult = await runProcess({
        command: 'g++',
        args: ['solution.cpp', '-O2', '-std=c++17', '-o', 'solution.exe'],
        cwd: execDir,
        timeoutMs: 8000,
      });

      if (compileResult.timedOut || compileResult.exitCode !== 0) {
        compilationError = sanitizeOutput(
          compileResult.stderr || compileResult.stdout || 'Compilation failed',
          execDir
        );
      } else {
        runCommand = exeFile;
        runArgs = [];
      }

    } else if (normalizedLang === 'java') {
      // Extract public class name or fallback to Solution
      const classMatch = code.match(/public\s+class\s+([A-Za-z0-9_]+)/);
      const className = classMatch ? classMatch[1] : 'Solution';
      const sourceFile = path.join(execDir, `${className}.java`);
      fs.writeFileSync(sourceFile, code, 'utf8');

      // Compile Java
      const compileResult = await runProcess({
        command: 'javac',
        args: [`${className}.java`],
        cwd: execDir,
        timeoutMs: 8000,
      });

      if (compileResult.timedOut || compileResult.exitCode !== 0) {
        compilationError = sanitizeOutput(
          compileResult.stderr || compileResult.stdout || 'Compilation failed',
          execDir
        );
      } else {
        runCommand = 'java';
        runArgs = [className];
      }
    } else {
      return {
        success: false,
        verdict: 'CE',
        passedCount: 0,
        totalCount: 0,
        executionTimeMs: 0,
        output: '',
        error: `Unsupported language: ${language}. Supported languages: python, cpp, java.`,
        testResults: [],
      };
    }

    // Return compilation error if occurred
    if (compilationError) {
      return {
        success: false,
        verdict: 'CE',
        passedCount: 0,
        totalCount: Math.max(testCases.length, 1),
        executionTimeMs: 0,
        output: '',
        error: compilationError,
        testResults: [],
      };
    }

    // 2. Prepare Test Cases
    let testsToRun = [];
    if (Array.isArray(testCases) && testCases.length > 0) {
      testsToRun = testCases.map((tc, idx) => ({
        index: idx + 1,
        input: tc.input != null ? String(tc.input) : '',
        expectedOutput: tc.expectedOutput != null ? String(tc.expectedOutput) : null,
      }));
    } else if (customInput != null) {
      testsToRun = [
        {
          index: 1,
          input: String(customInput),
          expectedOutput: null,
        },
      ];
    } else {
      testsToRun = [
        {
          index: 1,
          input: '',
          expectedOutput: null,
        },
      ];
    }

    // 3. Execute against all test cases
    const testResults = [];
    let overallVerdict = 'AC';
    let totalExecTime = 0;
    let primaryOutput = '';
    let primaryError = null;

    for (const test of testsToRun) {
      const execRes = await runProcess({
        command: runCommand,
        args: runArgs,
        cwd: execDir,
        input: test.input,
        timeoutMs,
      });

      const execDuration = execRes.durationMs;
      totalExecTime += execDuration;

      let testVerdict = 'AC';
      let testPassed = true;
      let testError = null;

      if (execRes.timedOut) {
        testVerdict = 'TLE';
        testPassed = false;
        testError = `Time Limit Exceeded (${timeoutMs}ms)`;
        if (overallVerdict === 'AC') overallVerdict = 'TLE';
      } else if (execRes.exitCode !== 0) {
        testVerdict = 'RE';
        testPassed = false;
        testError = sanitizeOutput(execRes.stderr || 'Runtime Error (non-zero exit code)', execDir);
        if (overallVerdict === 'AC' || overallVerdict === 'WA') overallVerdict = 'RE';
      } else {
        const actualTrimmed = execRes.stdout.trimEnd();
        if (test.expectedOutput != null) {
          const expectedTrimmed = test.expectedOutput.trimEnd();
          if (actualTrimmed === expectedTrimmed) {
            testVerdict = 'AC';
            testPassed = true;
          } else {
            testVerdict = 'WA';
            testPassed = false;
            testError = 'Output did not match expected output';
            if (overallVerdict === 'AC') overallVerdict = 'WA';
          }
        } else {
          testVerdict = 'AC';
          testPassed = true;
        }
      }

      if (!primaryOutput && execRes.stdout) {
        primaryOutput = execRes.stdout;
      }
      if (!primaryError && testError) {
        primaryError = testError;
      }

      testResults.push({
        testIndex: test.index,
        input: test.input,
        expectedOutput: test.expectedOutput,
        actualOutput: execRes.stdout,
        passed: testPassed,
        verdict: testVerdict,
        executionTimeMs: execDuration,
        error: testError,
      });
    }

    const passedCount = testResults.filter((t) => t.passed).length;
    const avgTimeMs = Math.round(totalExecTime / testResults.length);

    return {
      success: overallVerdict === 'AC',
      verdict: overallVerdict,
      passedCount,
      totalCount: testResults.length,
      executionTimeMs: avgTimeMs,
      output: primaryOutput || (overallVerdict === 'AC' ? 'Program finished with code 0' : ''),
      error: primaryError,
      testResults,
    };
  } catch (err) {
    return {
      success: false,
      verdict: 'RE',
      passedCount: 0,
      totalCount: Math.max(testCases.length, 1),
      executionTimeMs: 0,
      output: '',
      error: err.message || 'Unknown internal execution error',
      testResults: [],
    };
  } finally {
    // Clean up temporary workspace directory
    try {
      if (fs.existsSync(execDir)) {
        fs.rmSync(execDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore cleanup error
    }
  }
}
