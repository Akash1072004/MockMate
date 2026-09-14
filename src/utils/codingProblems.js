/**
 * Curated DSA Coding Problem Bank for MockMate AI Interview
 * Covers meaningful DSA topics: Dynamic Programming, Graphs, Trees, Sliding Window, Two Pointers, Stack, Binary Search, Arrays & Hashing.
 * Each problem includes full metadata, problem statement, input/output specifications, constraints, examples,
 * and language-specific starter boilerplate (Python, C++, Java, JavaScript).
 */

export const CURATED_CODING_PROBLEMS = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    topic: 'Arrays & Hashing',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.',
    input_format: 'nums = [2,7,11,15], target = 9',
    output_format: '[0,1]',
    constraints: '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.',
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]', explanation: 'Because nums[1] + nums[2] == 6, we return [1, 2].' },
      { input: 'nums = [3,3], target = 6', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 6, we return [0, 1].' }
    ],
    starter_code: {
      python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        # Implement your O(n) hash map approach here
        pass
`,
      cpp: `#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Implement your O(n) hash map approach here
        return {};
    }
};
`,
      java: `import java.util.HashMap;
import java.util.Map;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Implement your O(n) hash map approach here
        return new int[]{};
    }
}
`,
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
    // Implement your O(n) hash map approach here
    return [];
}
`
    }
  },
  {
    id: 'valid-palindrome',
    title: 'Valid Palindrome',
    difficulty: 'Easy',
    topic: 'Two Pointers & Strings',
    description: 'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.\n\nGiven a string s, return true if it is a palindrome, or false otherwise.',
    input_format: 's = "A man, a plan, a canal: Panama"',
    output_format: 'true',
    constraints: '1 <= s.length <= 2 * 10^5\ns consists only of printable ASCII characters.',
    examples: [
      { input: 's = "A man, a plan, a canal: Panama"', output: 'true', explanation: '"amanaplanacanalpanama" reads the same forward and backward.' },
      { input: 's = "race a car"', output: 'false', explanation: '"raceacar" is not a palindrome.' },
      { input: 's = " "', output: 'true', explanation: 'An empty string reads the same forward and backward.' }
    ],
    starter_code: {
      python: `class Solution:
    def isPalindrome(self, s: str) -> bool:
        # Implement your two-pointer solution here
        pass
`,
      cpp: `#include <string>
#include <cctype>
using namespace std;

class Solution {
public:
    bool isPalindrome(string s) {
        // Implement your two-pointer solution here
        return false;
    }
};
`,
      java: `class Solution {
    public boolean isPalindrome(String s) {
        // Implement your two-pointer solution here
        return false;
    }
}
`,
      javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
function isPalindrome(s) {
    // Implement your two-pointer solution here
    return false;
}
`
    }
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    topic: 'Stack & Strings',
    description: 'Given a string s containing just the characters \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.',
    input_format: 's = "()[]{}"',
    output_format: 'true',
    constraints: '1 <= s.length <= 10^4\ns consists of parentheses only \'()[]{}\'.',
    examples: [
      { input: 's = "()"', output: 'true', explanation: 'Valid matching parentheses.' },
      { input: 's = "()[]{}"', output: 'true', explanation: 'All bracket pairs match in correct order.' },
      { input: 's = "(]"', output: 'false', explanation: 'Mismatched closing bracket.' }
    ],
    starter_code: {
      python: `class Solution:
    def isValid(self, s: str) -> bool:
        # Implement your stack-based matching here
        pass
`,
      cpp: `#include <string>
#include <stack>
#include <unordered_map>
using namespace std;

class Solution {
public:
    bool isValid(string s) {
        // Implement your stack-based matching here
        return false;
    }
};
`,
      java: `import java.util.Stack;

class Solution {
    public boolean isValid(String s) {
        // Implement your stack-based matching here
        return false;
    }
}
`,
      javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
function isValid(s) {
    // Implement your stack-based matching here
    return false;
}
`
    }
  },
  {
    id: 'climbing-stairs',
    title: 'Climbing Stairs',
    difficulty: 'Easy',
    topic: 'Dynamic Programming',
    description: 'You are climbing a staircase. It takes n steps to reach the top.\n\nEach time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?',
    input_format: 'n = 3',
    output_format: '3',
    constraints: '1 <= n <= 45',
    examples: [
      { input: 'n = 2', output: '2', explanation: 'There are two ways: 1 step + 1 step, or 2 steps.' },
      { input: 'n = 3', output: '3', explanation: 'There are three ways: 1+1+1, 1+2, or 2+1.' }
    ],
    starter_code: {
      python: `class Solution:
    def climbStairs(self, n: int) -> int:
        # Implement dynamic programming approach here
        pass
`,
      cpp: `class Solution {
public:
    int climbStairs(int n) {
        // Implement dynamic programming approach here
        return 0;
    }
};
`,
      java: `class Solution {
    public int climbStairs(int n) {
        // Implement dynamic programming approach here
        return 0;
    }
}
`,
      javascript: `/**
 * @param {number} n
 * @return {number}
 */
function climbStairs(n) {
    // Implement dynamic programming approach here
    return 0;
}
`
    }
  },
  {
    id: 'binary-search',
    title: 'Binary Search',
    difficulty: 'Easy',
    topic: 'Binary Search',
    description: 'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.\n\nYou must write an algorithm with O(log n) runtime complexity.',
    input_format: 'nums = [-1,0,3,5,9,12], target = 9',
    output_format: '4',
    constraints: '1 <= nums.length <= 10^4\n-10^4 < nums[i], target < 10^4\nAll integers in nums are unique.\nnums is sorted in ascending order.',
    examples: [
      { input: 'nums = [-1,0,3,5,9,12], target = 9', output: '4', explanation: '9 exists in nums and its index is 4.' },
      { input: 'nums = [-1,0,3,5,9,12], target = 2', output: '-1', explanation: '2 does not exist in nums so return -1.' }
    ],
    starter_code: {
      python: `class Solution:
    def search(self, nums: list[int], target: int) -> int:
        # Implement O(log n) binary search
        pass
`,
      cpp: `#include <vector>
using namespace std;

class Solution {
public:
    int search(vector<int>& nums, int target) {
        // Implement O(log n) binary search
        return -1;
    }
};
`,
      java: `class Solution {
    public int search(int[] nums, int target) {
        // Implement O(log n) binary search
        return -1;
    }
}
`,
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
function search(nums, target) {
    // Implement O(log n) binary search
    return -1;
}
`
    }
  },
  {
    id: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    topic: 'Sliding Window',
    description: 'Given a string s, find the length of the longest substring without repeating characters.\n\nA substring is a contiguous non-empty sequence of characters within a string.',
    input_format: 's = "abcabcbb"',
    output_format: '3',
    constraints: '0 <= s.length <= 5 * 10^4\ns consists of English letters, digits, symbols and spaces.',
    examples: [
      { input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc", with the length of 3.' },
      { input: 's = "bbbbb"', output: '1', explanation: 'The answer is "b", with the length of 1.' },
      { input: 's = "pwwkew"', output: '3', explanation: 'The answer is "wke", with the length of 3.' }
    ],
    starter_code: {
      python: `class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        # Implement sliding window with hash set/map
        pass
`,
      cpp: `#include <string>
#include <unordered_map>
#include <algorithm>
using namespace std;

class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        // Implement sliding window with hash map
        return 0;
    }
};
`,
      java: `import java.util.HashMap;

class Solution {
    public int lengthOfLongestSubstring(String s) {
        // Implement sliding window with hash map
        return 0;
    }
}
`,
      javascript: `/**
 * @param {string} s
 * @return {number}
 */
function lengthOfLongestSubstring(s) {
    // Implement sliding window with hash map
    return 0;
}
`
    }
  },
  {
    id: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'Medium',
    topic: 'Dynamic Programming & Arrays',
    description: 'Given an integer array nums, find the subarray with the largest sum, and return its sum.\n\nA subarray is a contiguous non-empty sequence of elements within an array.',
    input_format: 'nums = [-2,1,-3,4,-1,2,1,-5,4]',
    output_format: '6',
    constraints: '1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4',
    examples: [
      { input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: 'The subarray [4,-1,2,1] has the largest sum 6.' },
      { input: 'nums = [1]', output: '1', explanation: 'The subarray [1] has the largest sum 1.' },
      { input: 'nums = [5,4,-1,7,8]', output: '23', explanation: 'The subarray [5,4,-1,7,8] has the largest sum 23.' }
    ],
    starter_code: {
      python: `class Solution:
    def maxSubArray(self, nums: list[int]) -> int:
        # Implement Kadane's algorithm / DP
        pass
`,
      cpp: `#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        // Implement Kadane's algorithm / DP
        return 0;
    }
};
`,
      java: `class Solution {
    public int maxSubArray(int[] nums) {
        // Implement Kadane's algorithm / DP
        return 0;
    }
}
`,
      javascript: `/**
 * @param {number[]} nums
 * @return {number}
 */
function maxSubArray(nums) {
    // Implement Kadane's algorithm / DP
    return 0;
}
`
    }
  },
  {
    id: 'number-of-islands',
    title: 'Number of Islands',
    difficulty: 'Medium',
    topic: 'Graphs & BFS / DFS',
    description: 'Given an m x n 2D binary grid grid which represents a map of \'1\'s (land) and \'0\'s (water), return the number of islands.\n\nAn island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically. You may assume all four edges of the grid are all surrounded by water.',
    input_format: 'grid = [["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]',
    output_format: '1',
    constraints: 'm == grid.length\nn == grid[i].length\n1 <= m, n <= 300\ngrid[i][j] is \'0\' or \'1\'.',
    examples: [
      { input: 'grid = [["1","1","1"],["0","1","0"],["1","1","1"]]', output: '1', explanation: 'Connected lands form 1 island.' },
      { input: 'grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]', output: '3', explanation: 'There are 3 isolated islands.' }
    ],
    starter_code: {
      python: `class Solution:
    def numIslands(self, grid: list[list[str]]) -> int:
        # Implement BFS or DFS graph traversal
        pass
`,
      cpp: `#include <vector>
using namespace std;

class Solution {
public:
    int numIslands(vector<vector<char>>& grid) {
        // Implement BFS or DFS graph traversal
        return 0;
    }
};
`,
      java: `class Solution {
    public int numIslands(char[][] grid) {
        // Implement BFS or DFS graph traversal
        return 0;
    }
}
`,
      javascript: `/**
 * @param {character[][]} grid
 * @return {number}
 */
function numIslands(grid) {
    // Implement BFS or DFS graph traversal
    return 0;
}
`
    }
  },
  {
    id: 'binary-tree-level-order-traversal',
    title: 'Binary Tree Level Order Traversal',
    difficulty: 'Medium',
    topic: 'Trees & BFS',
    description: 'Given the root of a binary tree, return the level order traversal of its nodes\' values. (i.e., from left to right, level by level).',
    input_format: 'root = [3,9,20,null,null,15,7]',
    output_format: '[[3],[9,20],[15,7]]',
    constraints: 'The number of nodes in the tree is in the range [0, 2000].\n-1000 <= Node.val <= 1000',
    examples: [
      { input: 'root = [3,9,20,null,null,15,7]', output: '[[3],[9,20],[15,7]]', explanation: 'Level 0: [3], Level 1: [9,20], Level 2: [15,7].' },
      { input: 'root = [1]', output: '[[1]]', explanation: 'Single root node.' },
      { input: 'root = []', output: '[]', explanation: 'Empty tree returns empty list.' }
    ],
    starter_code: {
      python: `from collections import deque

class Solution:
    def levelOrder(self, root) -> list[list[int]]:
        # Implement queue-based BFS traversal
        pass
`,
      cpp: `#include <vector>
#include <queue>
using namespace std;

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

class Solution {
public:
    vector<vector<int>> levelOrder(TreeNode* root) {
        // Implement queue-based BFS traversal
        return {};
    }
};
`,
      java: `import java.util.*;

class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        // Implement queue-based BFS traversal
        return new ArrayList<>();
    }
}
`,
      javascript: `/**
 * @param {TreeNode} root
 * @return {number[][]}
 */
function levelOrder(root) {
    // Implement queue-based BFS traversal
    return [];
}
`
    }
  },
  {
    id: 'coin-change',
    title: 'Coin Change',
    difficulty: 'Medium',
    topic: 'Dynamic Programming',
    description: 'You are given an integer array coins representing coins of different denominations and an integer amount representing a total amount of money.\n\nReturn the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return -1.\n\nYou may assume that you have an infinite number of each kind of coin.',
    input_format: 'coins = [1,2,5], amount = 11',
    output_format: '3',
    constraints: '1 <= coins.length <= 12\n1 <= coins[i] <= 2^31 - 1\n0 <= amount <= 10^4',
    examples: [
      { input: 'coins = [1,2,5], amount = 11', output: '3', explanation: '11 = 5 + 5 + 1 (3 coins total).' },
      { input: 'coins = [2], amount = 3', output: '-1', explanation: 'Amount 3 cannot be formed using coin 2.' },
      { input: 'coins = [1], amount = 0', output: '0', explanation: '0 amount requires 0 coins.' }
    ],
    starter_code: {
      python: `class Solution:
    def coinChange(self, coins: list[int], amount: int) -> int:
        # Implement bottom-up dynamic programming
        pass
`,
      cpp: `#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    int coinChange(vector<int>& coins, int amount) {
        // Implement bottom-up dynamic programming
        return -1;
    }
};
`,
      java: `import java.util.Arrays;

class Solution {
    public int coinChange(int[] coins, int amount) {
        // Implement bottom-up dynamic programming
        return -1;
    }
}
`,
      javascript: `/**
 * @param {number[]} coins
 * @param {number} amount
 * @return {number}
 */
function coinChange(coins, amount) {
    // Implement bottom-up dynamic programming
    return -1;
}
`
    }
  },
  {
    id: 'course-schedule',
    title: 'Course Schedule',
    difficulty: 'Medium',
    topic: 'Graphs & Topological Sort',
    description: 'There are a total of numCourses courses you have to take, labeled from 0 to numCourses - 1. You are given an array prerequisites where prerequisites[i] = [ai, bi] indicates that you must take course bi first if you want to take course ai.\n\nReturn true if you can finish all courses. Otherwise, return false (i.e. cycle detection in directed graph).',
    input_format: 'numCourses = 2, prerequisites = [[1,0]]',
    output_format: 'true',
    constraints: '1 <= numCourses <= 2000\n0 <= prerequisites.length <= 5000\nprerequisites[i].length == 2\n0 <= ai, bi < numCourses\nAll the pairs prerequisites[i] are unique.',
    examples: [
      { input: 'numCourses = 2, prerequisites = [[1,0]]', output: 'true', explanation: 'To take course 1 you should have finished course 0. So it is possible.' },
      { input: 'numCourses = 2, prerequisites = [[1,0],[0,1]]', output: 'false', explanation: 'There is a cyclic dependency between course 0 and 1.' }
    ],
    starter_code: {
      python: `from collections import defaultdict, deque

class Solution:
    def canFinish(self, numCourses: int, prerequisites: list[list[int]]) -> bool:
        # Implement Kahn's algorithm (indegree BFS) or DFS cycle detection
        pass
`,
      cpp: `#include <vector>
#include <queue>
using namespace std;

class Solution {
public:
    bool canFinish(int numCourses, vector<vector<int>>& prerequisites) {
        // Implement Kahn's algorithm or DFS cycle detection
        return false;
    }
};
`,
      java: `import java.util.*;

class Solution {
    public boolean canFinish(int numCourses, int[][] prerequisites) {
        // Implement Kahn's algorithm or DFS cycle detection
        return false;
    }
}
`,
      javascript: `/**
 * @param {number} numCourses
 * @param {number[][]} prerequisites
 * @return {boolean}
 */
function canFinish(numCourses, prerequisites) {
    // Implement Kahn's algorithm or DFS cycle detection
    return false;
}
`
    }
  },
  {
    id: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'Hard',
    topic: 'Two Pointers & Arrays',
    description: 'Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.',
    input_format: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]',
    output_format: '6',
    constraints: 'n == height.length\n1 <= n <= 2 * 10^4\n0 <= height[i] <= 10^5',
    examples: [
      { input: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]', output: '6', explanation: 'The elevation map is [0,1,0,2,1,0,1,3,2,1,2,1]. Total 6 units of rain water are trapped.' },
      { input: 'height = [4,2,0,3,2,5]', output: '9', explanation: 'Total 9 units of rain water are trapped.' }
    ],
    starter_code: {
      python: `class Solution:
    def trap(self, height: list[int]) -> int:
        # Implement two pointers or monotonic stack
        pass
`,
      cpp: `#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    int trap(vector<int>& height) {
        // Implement two pointers or monotonic stack
        return 0;
    }
};
`,
      java: `class Solution {
    public int trap(int[] height) {
        // Implement two pointers or monotonic stack
        return 0;
    }
}
`,
      javascript: `/**
 * @param {number[]} height
 * @return {number}
 */
function trap(height) {
    // Implement two pointers or monotonic stack
    return 0;
}
`
    }
  }
];

export const DEFAULT_CODING_PROBLEM = CURATED_CODING_PROBLEMS[0]; // Two Sum

/**
 * Controlled Random Selection of a DSA Coding Problem
 * Selects an appropriate problem once based on difficulty and track.
 * Supports excluding a specific ID to avoid immediate repetition.
 */
export function selectCodingProblem({ difficulty = 'Medium', track = 'DSA', excludeId = null } = {}) {
  const normDiff = String(difficulty || 'Medium').trim().toLowerCase();
  
  let candidates = CURATED_CODING_PROBLEMS.filter(p => p.difficulty.toLowerCase() === normDiff);
  
  if (candidates.length === 0) {
    if (normDiff === 'hard') {
      candidates = CURATED_CODING_PROBLEMS.filter(p => p.difficulty === 'Hard' || p.difficulty === 'Medium');
    } else if (normDiff === 'easy') {
      candidates = CURATED_CODING_PROBLEMS.filter(p => p.difficulty === 'Easy');
    } else {
      candidates = CURATED_CODING_PROBLEMS.filter(p => p.difficulty === 'Medium');
    }
  }

  if (candidates.length === 0) {
    candidates = CURATED_CODING_PROBLEMS;
  }

  if (excludeId && candidates.length > 1) {
    const withoutExcluded = candidates.filter(p => p.id !== excludeId);
    if (withoutExcluded.length > 0) {
      candidates = withoutExcluded;
    }
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex] || DEFAULT_CODING_PROBLEM;
}

/**
 * Get language-specific starter boilerplate for a problem
 */
export function getStarterCodeForProblem(problem, language) {
  if (!problem) return '';
  const langKey = String(language || 'python').toLowerCase();
  if (problem.starter_code && problem.starter_code[langKey]) {
    return problem.starter_code[langKey];
  }
  return '';
}
