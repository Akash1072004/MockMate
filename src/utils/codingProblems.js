/**
 * Curated Competitive Programming Problem Bank for MockMate AI Interview (Codeforces Style)
 * 
 * Flow:
 * 1. AI gives coding problem
 * 2. Problem statement + examples + contest-style test cases (stdin -> stdout)
 * 3. Candidate writes complete program from scratch (no LeetCode class Solution, no auto-generated solutions)
 * 4. Candidate runs code against test cases via stdin/stdout
 */

import { CODE_TEMPLATES } from './codeTemplates.js';

export const CURATED_CODING_PROBLEMS = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    topic: 'Arrays & Hashing',
    description: 'Given an array of integers nums and an integer target, find two distinct 0-based indices i and j such that nums[i] + nums[j] == target. Print the two indices separated by a space in ascending order.',
    input_format: 'The first line contains two integers n (2 <= n <= 10^5) and target (-10^9 <= target <= 10^9).\nThe second line contains n space-separated integers nums[0], nums[1], ..., nums[n-1].',
    output_format: 'Print two space-separated integers representing the 0-based indices.',
    constraints: '2 <= n <= 10^5\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nExactly one valid solution exists.',
    examples: [
      {
        input: '4 9\n2 7 11 15',
        output: '0 1',
        explanation: 'Because nums[0] + nums[1] == 2 + 7 == 9, we output 0 1.',
      },
      {
        input: '3 6\n3 2 4',
        output: '1 2',
        explanation: 'Because nums[1] + nums[2] == 2 + 4 == 6, we output 1 2.',
      },
      {
        input: '2 6\n3 3',
        output: '0 1',
        explanation: 'Because nums[0] + nums[1] == 3 + 3 == 6, we output 0 1.',
      },
    ],
    testCases: [
      {
        index: 1,
        input: '4 9\n2 7 11 15',
        expectedOutput: '0 1',
      },
      {
        index: 2,
        input: '3 6\n3 2 4',
        expectedOutput: '1 2',
      },
      {
        index: 3,
        input: '2 6\n3 3',
        expectedOutput: '0 1',
      },
    ],
    starter_code: CODE_TEMPLATES,
  },

  {
    id: 'array-sum',
    title: 'Array Sum',
    difficulty: 'Easy',
    topic: 'Basic Implementation',
    description: 'Given an integer n followed by n integers, calculate and print the sum of all elements.',
    input_format: 'The first line contains an integer n (1 <= n <= 10^5).\nThe second line contains n space-separated integers.',
    output_format: 'Print a single integer representing the sum of the numbers.',
    constraints: '1 <= n <= 10^5\n-10^9 <= elements <= 10^9',
    examples: [
      {
        input: '5\n1 2 3 4 5',
        output: '15',
        explanation: '1 + 2 + 3 + 4 + 5 = 15.',
      },
      {
        input: '3\n10 -5 20',
        output: '25',
        explanation: '10 + (-5) + 20 = 25.',
      },
    ],
    testCases: [
      {
        index: 1,
        input: '5\n1 2 3 4 5',
        expectedOutput: '15',
      },
      {
        index: 2,
        input: '3\n10 -5 20',
        expectedOutput: '25',
      },
      {
        index: 3,
        input: '1\n42',
        expectedOutput: '42',
      },
    ],
    starter_code: CODE_TEMPLATES,
  },

  {
    id: 'binary-search',
    title: 'Binary Search',
    difficulty: 'Easy',
    topic: 'Binary Search',
    description: 'Given a sorted array of n integers and an integer target, search for target in nums. If target exists, print its 0-based index. Otherwise, print -1.',
    input_format: 'The first line contains two integers n (1 <= n <= 10^5) and target.\nThe second line contains n space-separated sorted integers.',
    output_format: 'Print the 0-based index of target, or -1 if target is not found.',
    constraints: '1 <= n <= 10^5\nAll elements in nums are unique and sorted in ascending order.',
    examples: [
      {
        input: '6 9\n-1 0 3 5 9 12',
        output: '4',
        explanation: '9 exists in nums and its index is 4.',
      },
      {
        input: '6 2\n-1 0 3 5 9 12',
        output: '-1',
        explanation: '2 does not exist in nums so print -1.',
      },
    ],
    testCases: [
      {
        index: 1,
        input: '6 9\n-1 0 3 5 9 12',
        expectedOutput: '4',
      },
      {
        index: 2,
        input: '6 2\n-1 0 3 5 9 12',
        expectedOutput: '-1',
      },
      {
        index: 3,
        input: '1 5\n5',
        expectedOutput: '0',
      },
    ],
    starter_code: CODE_TEMPLATES,
  },

  {
    id: 'valid-palindrome',
    title: 'Valid Palindrome',
    difficulty: 'Easy',
    topic: 'Two Pointers',
    description: 'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Print "true" if the string is a palindrome, or "false" otherwise.',
    input_format: 'A single line containing the string s.',
    output_format: 'Print true or false.',
    constraints: '1 <= s.length <= 2 * 10^5\ns consists only of printable ASCII characters.',
    examples: [
      {
        input: 'A man, a plan, a canal: Panama',
        output: 'true',
        explanation: '"amanaplanacanalpanama" is a palindrome.',
      },
      {
        input: 'race a car',
        output: 'false',
        explanation: '"raceacar" is not a palindrome.',
      },
    ],
    testCases: [
      {
        index: 1,
        input: 'A man, a plan, a canal: Panama',
        expectedOutput: 'true',
      },
      {
        index: 2,
        input: 'race a car',
        expectedOutput: 'false',
      },
      {
        index: 3,
        input: 'ab_a',
        expectedOutput: 'true',
      },
    ],
    starter_code: CODE_TEMPLATES,
  },

  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    topic: 'Stack',
    description: 'Given a string s containing just the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid. An input string is valid if open brackets are closed by the same type of brackets in the correct order. Print "true" or "false".',
    input_format: 'A single line containing the string s.',
    output_format: 'Print true or false.',
    constraints: '1 <= s.length <= 10^4',
    examples: [
      {
        input: '()[]{}',
        output: 'true',
        explanation: 'All brackets match in correct order.',
      },
      {
        input: '(]',
        output: 'false',
        explanation: 'Mismatched bracket types.',
      },
    ],
    testCases: [
      {
        index: 1,
        input: '()',
        expectedOutput: 'true',
      },
      {
        index: 2,
        input: '()[]{}',
        expectedOutput: 'true',
      },
      {
        index: 3,
        input: '(]',
        expectedOutput: 'false',
      },
    ],
    starter_code: CODE_TEMPLATES,
  },

  {
    id: 'climbing-stairs',
    title: 'Climbing Stairs',
    difficulty: 'Easy',
    topic: 'Dynamic Programming',
    description: 'You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?',
    input_format: 'A single integer n (1 <= n <= 45).',
    output_format: 'Print the number of distinct ways to climb to the top.',
    constraints: '1 <= n <= 45',
    examples: [
      {
        input: '2',
        output: '2',
        explanation: '1 step + 1 step, or 2 steps.',
      },
      {
        input: '3',
        output: '3',
        explanation: '1+1+1, 1+2, or 2+1.',
      },
    ],
    testCases: [
      {
        index: 1,
        input: '2',
        expectedOutput: '2',
      },
      {
        index: 2,
        input: '3',
        expectedOutput: '3',
      },
      {
        index: 3,
        input: '5',
        expectedOutput: '8',
      },
    ],
    starter_code: CODE_TEMPLATES,
  },

  {
    id: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'Medium',
    topic: 'Dynamic Programming',
    description: 'Given an array of n integers, find the contiguous subarray (containing at least one number) which has the largest sum and print its sum.',
    input_format: 'The first line contains an integer n (1 <= n <= 10^5).\nThe second line contains n space-separated integers.',
    output_format: 'Print a single integer representing the maximum subarray sum.',
    constraints: '1 <= n <= 10^5\n-10^4 <= nums[i] <= 10^4',
    examples: [
      {
        input: '9\n-2 1 -3 4 -1 2 1 -5 4',
        output: '6',
        explanation: 'The subarray [4,-1,2,1] has the largest sum = 6.',
      },
      {
        input: '1\n1',
        output: '1',
        explanation: 'The subarray [1] has sum = 1.',
      },
      {
        input: '5\n5 4 -1 7 8',
        output: '23',
        explanation: 'The entire array sum is 23.',
      },
    ],
    testCases: [
      {
        index: 1,
        input: '9\n-2 1 -3 4 -1 2 1 -5 4',
        expectedOutput: '6',
      },
      {
        index: 2,
        input: '1\n1',
        expectedOutput: '1',
      },
      {
        index: 3,
        input: '5\n5 4 -1 7 8',
        expectedOutput: '23',
      },
    ],
    starter_code: CODE_TEMPLATES,
  },

  {
    id: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    topic: 'Sliding Window',
    description: 'Given a string s, find the length of the longest substring without repeating characters.',
    input_format: 'A single line containing the string s.',
    output_format: 'Print a single integer representing the length of the longest substring.',
    constraints: '0 <= s.length <= 5 * 10^4',
    examples: [
      {
        input: 'abcabcbb',
        output: '3',
        explanation: 'The answer is "abc", with the length of 3.',
      },
      {
        input: 'bbbbb',
        output: '1',
        explanation: 'The answer is "b", with the length of 1.',
      },
      {
        input: 'pwwkew',
        output: '3',
        explanation: 'The answer is "wke", with the length of 3.',
      },
    ],
    testCases: [
      {
        index: 1,
        input: 'abcabcbb',
        expectedOutput: '3',
      },
      {
        index: 2,
        input: 'bbbbb',
        expectedOutput: '1',
      },
      {
        index: 3,
        input: 'pwwkew',
        expectedOutput: '3',
      },
    ],
    starter_code: CODE_TEMPLATES,
  },

  {
    id: 'coin-change',
    title: 'Coin Change',
    difficulty: 'Medium',
    topic: 'Dynamic Programming',
    description: 'You are given an integer array coins representing coins of different denominations and an integer amount representing a total amount of money. Return the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, print -1.',
    input_format: 'The first line contains two integers n (number of coin types) and amount.\nThe second line contains n space-separated integers representing coin denominations.',
    output_format: 'Print the fewest number of coins needed, or -1.',
    constraints: '1 <= coins.length <= 12\n1 <= coins[i] <= 2^31 - 1\n0 <= amount <= 10^4',
    examples: [
      {
        input: '3 11\n1 2 5',
        output: '3',
        explanation: '11 = 5 + 5 + 1 (3 coins).',
      },
      {
        input: '1 3\n2',
        output: '-1',
        explanation: 'The amount of 3 cannot be formed using coins of denomination 2.',
      },
    ],
    testCases: [
      {
        index: 1,
        input: '3 11\n1 2 5',
        expectedOutput: '3',
      },
      {
        index: 2,
        input: '1 3\n2',
        expectedOutput: '-1',
      },
      {
        index: 3,
        input: '1 0\n1',
        expectedOutput: '0',
      },
    ],
    starter_code: CODE_TEMPLATES,
  },

  {
    id: 'number-of-islands',
    title: 'Number of Islands',
    difficulty: 'Medium',
    topic: 'Graphs',
    description: 'Given an m x n 2D binary grid which represents a map of "1"s (land) and "0"s (water), count the number of islands. An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.',
    input_format: 'The first line contains two integers m and n (rows and columns).\nThe next m lines each contain n space-separated characters ("1" or "0").',
    output_format: 'Print a single integer representing the number of islands.',
    constraints: '1 <= m, n <= 300',
    examples: [
      {
        input: '3 3\n1 1 1\n0 1 0\n1 1 1',
        output: '1',
        explanation: 'All lands are connected into one island.',
      },
      {
        input: '4 5\n1 1 0 0 0\n1 1 0 0 0\n0 0 1 0 0\n0 0 0 1 1',
        output: '3',
        explanation: 'There are 3 separate islands.',
      },
    ],
    testCases: [
      {
        index: 1,
        input: '3 3\n1 1 1\n0 1 0\n1 1 1',
        expectedOutput: '1',
      },
      {
        index: 2,
        input: '4 5\n1 1 0 0 0\n1 1 0 0 0\n0 0 1 0 0\n0 0 0 1 1',
        expectedOutput: '3',
      },
    ],
    starter_code: CODE_TEMPLATES,
  },

  {
    id: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'Hard',
    topic: 'Two Pointers',
    description: 'Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.',
    input_format: 'The first line contains an integer n (1 <= n <= 2 * 10^4).\nThe second line contains n space-separated non-negative integers.',
    output_format: 'Print the total units of water trapped.',
    constraints: '1 <= n <= 2 * 10^4\n0 <= height[i] <= 10^5',
    examples: [
      {
        input: '12\n0 1 0 2 1 0 1 3 2 1 2 1',
        output: '6',
        explanation: '6 units of rain water are being trapped.',
      },
      {
        input: '6\n4 2 0 3 2 5',
        output: '9',
        explanation: '9 units of rain water are trapped.',
      },
    ],
    testCases: [
      {
        index: 1,
        input: '12\n0 1 0 2 1 0 1 3 2 1 2 1',
        expectedOutput: '6',
      },
      {
        index: 2,
        input: '6\n4 2 0 3 2 5',
        expectedOutput: '9',
      },
    ],
    starter_code: CODE_TEMPLATES,
  },

  {
    id: 'course-schedule',
    title: 'Course Schedule',
    difficulty: 'Medium',
    topic: 'Graphs',
    description: 'There are a total of numCourses courses you have to take, labeled from 0 to numCourses - 1. You are given m prerequisites where each prerequisite pair [u, v] indicates you must take course v before course u. Return "true" if you can finish all courses, else "false".',
    input_format: 'The first line contains two integers numCourses and m.\nThe next m lines each contain two integers u and v.',
    output_format: 'Print true or false.',
    constraints: '1 <= numCourses <= 2000\n0 <= m <= 5000',
    examples: [
      {
        input: '2 1\n1 0',
        output: 'true',
        explanation: 'You can take course 0, then course 1.',
      },
      {
        input: '2 2\n1 0\n0 1',
        output: 'false',
        explanation: 'There is a cycle between course 0 and course 1.',
      },
    ],
    testCases: [
      {
        index: 1,
        input: '2 1\n1 0',
        expectedOutput: 'true',
      },
      {
        index: 2,
        input: '2 2\n1 0\n0 1',
        expectedOutput: 'false',
      },
    ],
    starter_code: CODE_TEMPLATES,
  },
];

export const DEFAULT_CODING_PROBLEM = CURATED_CODING_PROBLEMS[0];

/**
 * Select a coding problem matching difficulty and track
 */
export function selectCodingProblem({ difficulty = 'Medium', track = 'DSA', excludeIds = [] } = {}) {
  let candidates = CURATED_CODING_PROBLEMS.filter(
    (p) => !excludeIds.includes(p.id)
  );

  if (difficulty) {
    const diffMatches = candidates.filter(
      (p) => p.difficulty.toLowerCase() === difficulty.toLowerCase()
    );
    if (diffMatches.length > 0) candidates = diffMatches;
  }

  if (candidates.length === 0) {
    candidates = CURATED_CODING_PROBLEMS;
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex] || DEFAULT_CODING_PROBLEM;
}

/**
 * Get language-specific starter boilerplate for a problem (Codeforces Style)
 */
export function getStarterCodeForProblem(problem, language) {
  const langKey = String(language || 'cpp').toLowerCase();
  if (CODE_TEMPLATES[langKey]) {
    return CODE_TEMPLATES[langKey];
  }
  return CODE_TEMPLATES.cpp;
}
