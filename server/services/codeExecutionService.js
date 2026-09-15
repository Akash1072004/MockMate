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
        if (process.platform === 'win32' && child.pid) {
          spawn('taskkill', ['/pid', String(child.pid), '/f', '/t']).on('error', () => {});
        } else {
          child.kill('SIGKILL');
        }
      }
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      if (stdout.length < maxBuffer) {
        stdout += data.toString();
      }
    });

    child.stderr.on('data', (data) => {
      if (stderr.length < maxBuffer) {
        stderr += data.toString();
      }
    });

    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr || err.message,
        timedOut: false,
        durationMs: Date.now() - startTime,
      });
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        exitCode: code,
        stdout,
        stderr,
        timedOut,
        durationMs: Date.now() - startTime,
      });
    });

    // Feed stdin if provided
    try {
      if (input != null && input !== '') {
        child.stdin.write(input);
      }
      child.stdin.end();
    } catch (e) {
      // Child process might have exited early
    }
  });
}

/**
 * Sanitizes compiler/runtime error output so temporary filesystem paths
 * are replaced with clean, professional source references.
 */
function sanitizeOutput(text, tempDir) {
  if (!text || typeof text !== 'string') return '';
  return text.replaceAll(tempDir, '').replaceAll(tempDir.replace(/\\/g, '/'), '');
}

/**
 * Robust Contest-style output comparison.
 * - Trims whitespace
 * - Normalizes Windows/Unix line endings (\r\n -> \n)
 * - Compares exact string or token-by-token (ignoring multiple spaces / trailing newlines)
 */
export function compareOutputs(actual, expected) {
  if (actual == null && expected == null) return true;
  if (actual == null || expected == null) return false;

  const normAct = String(actual).replace(/\r\n/g, '\n').trim();
  const normExp = String(expected).replace(/\r\n/g, '\n').trim();

  if (normAct === normExp) return true;

  // Token-by-token comparison (handles multiple spaces, trailing newlines)
  const actTokens = normAct.split(/\s+/).filter(Boolean);
  const expTokens = normExp.split(/\s+/).filter(Boolean);

  if (actTokens.length === expTokens.length) {
    let allMatch = true;
    for (let i = 0; i < actTokens.length; i++) {
      if (actTokens[i] !== expTokens[i]) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true;
  }

  return false;
}

/**
 * Executes user-submitted code in competitive programming / contest style.
 * 
 * Supports:
 * - Direct standalone programs from scratch (Codeforces style)
 * - C++: compiled with g++ -std=c++17 and executed directly via stdin/stdout
 * - Python: executed with python via stdin/stdout
 * - Java: compiled with javac and executed via stdin/stdout
 * - JavaScript: executed with node via stdin/stdout
 * 
 * Verdicts:
 * - AC: Accepted (all test cases passed)
 * - WA: Wrong Answer (one or more test cases produced incorrect output)
 * - CE: Compilation Error (compiler failed)
 * - RE: Runtime Error (crashed / non-zero exit code)
 * - TLE: Time Limit Exceeded (execution exceeded timeout)
 */
export async function executeCode({
  language,
  code,
  testCases = [],
  customInput = null,
  questionId = null,
  timeoutMs = 5000,
}) {
  if (!code || typeof code !== 'string' || !code.trim()) {
    return {
      success: false,
      verdict: 'CE',
      passedCount: 0,
      totalCount: 0,
      executionTimeMs: 0,
      output: '',
      error: 'Code cannot be empty. Please write your program in the editor.',
      testResults: [],
    };
  }

  const normalizedLang = (language || 'python').toLowerCase().trim();
  const execDir = path.join(os.tmpdir(), 'mm_exec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));

  try {
    fs.mkdirSync(execDir, { recursive: true });

    // Prepare Test Cases to execute
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

      // Direct contest compilation with 25s limit and explicit timeout diagnostics
      const compileResult = await runProcess({
        command: 'g++',
        args: ['solution.cpp', '-std=c++17', '-o', 'solution.exe'],
        cwd: execDir,
        timeoutMs: 25000,
      });

      if (compileResult.timedOut) {
        compilationError = `Compilation timed out (${compileResult.durationMs || 25000}ms). The C++ compiler exceeded the time limit.\nNote: Including monolithic headers like <bits/stdc++.h> loads the entire C++ standard library and may compile slowly on cloud containers. Consider including specific headers (e.g. <iostream>, <vector>, <string>, <algorithm>).`;
      } else if (compileResult.exitCode !== 0) {
        let rawErr = (compileResult.stderr || '').trim() || (compileResult.stdout || '').trim();
        if (!rawErr) {
          rawErr = `Compilation process terminated with exit code ${compileResult.exitCode || 1} without compiler diagnostics.`;
        }
        if (/undefined reference to [`']WinMain(@16)?['`]/i.test(rawErr)) {
          rawErr = "Compilation Error: Entry point 'main()' not found.\nIn competitive programming, execution begins at 'int main() { ... }'. Please ensure your C++ program includes 'int main()'.";
        }
        compilationError = sanitizeOutput(rawErr, execDir);
      } else {
        runCommand = exeFile;
        runArgs = [];
      }

    } else if (normalizedLang === 'java') {
      // Find class name from code or default to Main
      const classMatch = code.match(/(?:public\s+)?class\s+([A-Za-z0-9_]+)/);
      const className = classMatch ? classMatch[1] : 'Main';
      const sourceFile = path.join(execDir, className + '.java');
      fs.writeFileSync(sourceFile, code, 'utf8');

      // Compile Java with 25s limit and explicit timeout diagnostics
      const compileResult = await runProcess({
        command: 'javac',
        args: [className + '.java'],
        cwd: execDir,
        timeoutMs: 25000,
      });

      if (compileResult.timedOut) {
        compilationError = `Compilation timed out (${compileResult.durationMs || 25000}ms). The Java compiler (javac) exceeded the time limit.`;
      } else if (compileResult.exitCode !== 0) {
        let rawErr = (compileResult.stderr || '').trim() || (compileResult.stdout || '').trim();
        if (!rawErr) {
          rawErr = `Java compilation process terminated with exit code ${compileResult.exitCode || 1}.`;
        }
        compilationError = sanitizeOutput(rawErr, execDir);
      } else {
        runCommand = 'java';
        runArgs = [className];
      }

    } else if (normalizedLang === 'javascript' || normalizedLang === 'js') {
      const filePath = path.join(execDir, 'solution.js');
      fs.writeFileSync(filePath, code, 'utf8');
      runCommand = 'node';
      runArgs = ['solution.js'];

    } else {
      return {
        success: false,
        verdict: 'CE',
        passedCount: 0,
        totalCount: 0,
        executionTimeMs: 0,
        output: '',
        error: 'Unsupported language: ' + language + '. Supported languages: cpp, python, java, javascript.',
        testResults: [],
      };
    }

    // Return compilation error if compilation failed
    if (compilationError) {
      return {
        success: false,
        verdict: 'CE',
        passedCount: 0,
        totalCount: Math.max(testsToRun.length, 1),
        executionTimeMs: 0,
        output: '',
        error: compilationError,
        testResults: [],
      };
    }

    // 2. Execute against all test cases via stdin/stdout
    const testResults = [];
    let overallVerdict = 'AC';
    let totalExecTime = 0;
    let firstErrorMsg = null;

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
        testError = 'Time Limit Exceeded (' + timeoutMs + 'ms)';
        if (overallVerdict === 'AC' || overallVerdict === 'WA') {
          overallVerdict = 'TLE';
          if (!firstErrorMsg) firstErrorMsg = testError;
        }
      } else if (execRes.exitCode !== 0) {
        testVerdict = 'RE';
        testPassed = false;
        testError = sanitizeOutput(
          execRes.stderr || 'Runtime Error: process terminated with non-zero exit code',
          execDir
        );
        if (overallVerdict === 'AC' || overallVerdict === 'WA') {
          overallVerdict = 'RE';
          if (!firstErrorMsg) firstErrorMsg = testError;
        }
      } else {
        const actualOutput = execRes.stdout;
        if (test.expectedOutput != null) {
          const isMatch = compareOutputs(actualOutput, test.expectedOutput);
          if (isMatch) {
            testVerdict = 'AC';
            testPassed = true;
          } else {
            testVerdict = 'WA';
            testPassed = false;
            testError = null; // WA is an expected output mismatch, not an exception
            if (overallVerdict === 'AC') {
              overallVerdict = 'WA';
            }
          }
        } else {
          // Custom input execution without expected output
          testVerdict = 'AC';
          testPassed = true;
        }
      }

      testResults.push({
        index: test.index,
        input: test.input,
        expectedOutput: test.expectedOutput,
        actualOutput: execRes.stdout.trimEnd(),
        passed: testPassed,
        verdict: testVerdict,
        durationMs: execDuration,
        error: testError,
      });
    }

    const passedCount = testResults.filter((t) => t.passed).length;
    const totalCount = testResults.length;
    const primaryOutput = testResults[0]?.actualOutput || '';

    return {
      success: overallVerdict === 'AC',
      verdict: overallVerdict,
      passedCount,
      totalCount,
      executionTimeMs: totalExecTime,
      output: primaryOutput,
      // Error message is ONLY populated for true runtime/TLE/CE failures, never for WA!
      error: firstErrorMsg,
      testResults,
    };

  } catch (err) {
    return {
      success: false,
      verdict: 'RE',
      passedCount: 0,
      totalCount: 1,
      executionTimeMs: 0,
      output: '',
      error: err.message || 'Execution failed unexpectedly',
      testResults: [],
    };
  } finally {
    // Clean up temporary execution directory
    try {
      if (fs.existsSync(execDir)) {
        fs.rmSync(execDir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}
