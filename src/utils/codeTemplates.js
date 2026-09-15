/**
 * Clean Contest Starter Templates for Competitive Programming (Codeforces Style)
 * Candidates start with a clean template and write the complete program from scratch.
 */

export const CODE_TEMPLATES = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Write your solution here

    return 0;
}
`,

  python: `import sys

def main():
    # Read from standard input
    input_data = sys.stdin.read().split()
    if not input_data:
        return

    # Write your solution here


if __name__ == '__main__':
    main()
`,

  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);

        // Write your solution here

    }
}
`,

  javascript: `const fs = require('fs');

function solve() {
    const input = fs.readFileSync(0, 'utf-8').trim();
    if (!input) return;

    // Write your solution here

}

solve();
`,
};

export const LANGUAGE_OPTIONS = [
  { id: 'cpp', label: 'C++ 17 (GCC)', ext: 'cpp' },
  { id: 'python', label: 'Python 3', ext: 'py' },
  { id: 'java', label: 'Java 21', ext: 'java' },
  { id: 'javascript', label: 'JavaScript (Node.js)', ext: 'js' },
];
