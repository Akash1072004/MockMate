/**
 * Starter boilerplate code templates for C++, Java, and Python
 */

export const CODE_TEMPLATES = {
  python: `# Python 3.12 Solution
import sys

def solve():
    """
    Implement your algorithm solution here.
    """
    print("Solution executed successfully")

if __name__ == "__main__":
    solve()
`,

  cpp: `// C++ 17 Solution
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Implement your algorithm solution here
    cout << "Solution executed successfully" << "\\n";

    return 0;
}
`,

  java: `// Java 21 Solution
import java.util.*;
import java.io.*;

public class Solution {
    public static void main(String[] args) {
        // Implement your algorithm solution here
        System.out.println("Solution executed successfully");
    }
}
`,
};

export const LANGUAGE_OPTIONS = [
  { id: 'python', label: 'Python 3', ext: 'py' },
  { id: 'cpp', label: 'C++ (GCC)', ext: 'cpp' },
  { id: 'java', label: 'Java 21', ext: 'java' },
];
