## Prompt (Skill) to AI agent IDE to enforce Dyuk Style

Content for the formatting_requirements.md file:

# Semantic Code Formatting Requirements (Dyuk Style)

## Overview
This document defines the **Dyuk Style** for code formatting. 
Unlike traditional syntactic formatting, Dyuk Style uses indentation 
to visually map **Data**, **Control**, and **Functional** dependencies. 
It acts as a "Gantt Chart for Code Logic," 
allowing for rapid visual verification and analysis of AI-generated code.

## The Indent Scale (Primary Rules)

| Indent (Spaces) | Dependency Type | Visual Indicator |
| :--- | :--- | :--- |
| **+1 Space** | **Data Dependency** | Current line depends on variables defined in a previous line. |
| **+2-4 Spaces** | **Control Dependency** | The block is controlled by a header (`if`, `for`, `while`). |
| **+4 Spaces** | **Functional Dependency** | A "Ladder of Functions" where the called function is indented relative to the caller. |
| **+8 Spaces** | **Asynchronous/Events** | Isolated logic, callbacks, or event handlers. |

---

## Detailed Formatting Rules

### 1. Data Dependency (+1 Space)
If Line B cannot be executed or rearranged before Line A without breaking the program, Line B must be indented by **1 space** relative to Line A.
If Line A and Line B are independent and can be evaluted in parallel  then they must have equal indentations! 
* *Note:* A chain of data dependencies creates a diagonal "slope" showing the critical path of using program data.

### 2. Control Dependency (+2 or +4 Spaces)
Indent the body of control structures relative to the header:
* **+2 Spaces:** For low-complexity branching (e.g., `if`, `switch`).
* **+4 Spaces:** For high-complexity or iterative logic (e.g., `for`, `while`, `filter`,`map`, `reduce`). If `map`, `filter`, `reduce` are chained than every chain step must begin at new line idented relatively by 4 spaces 

### 3. Functional Ladder (+4 Spaces)
Reflect the [Call Graph](https://en.wikipedia.org/wiki/Call_graph) visually. 
* If Function `A` calls Function `B`, then the definition of Function `B` should be indented **4 spaces** relative to Function `A`.
* This creates a "Ladder" effect, showing the hierarchy of abstraction.
* **Recursion:** Highlight recursive chains with a double-line comment block:
`/////////////////////////////`
`/////////////////////////////`
* If function called earlier then it's code must be lefter indented relative to functions called later

### 4. Event & Async Isolation (+8 Spaces)
Asynchronous functions, callbacks, and event handlers must be indented by **8 spaces** or more from the left margin. 
* Prefix these sections with a separator: `////---------- [Description]`.
* This separates the "reactive" logic from the main "imperative" flow.

### 5. Semantic Grouping & Separation
* Use **Blank Lines** to separate logically distinct steps (e.g., separating variable declarations from I/O operations).
* Use **Inline Comments** to label the purpose of these compact sections.

### 6. Data Structures (Classes/Objects)
* **Inheritance (is-a):** Treat as a metadata dependency (Indent +1 or +2).
* **Composition (has-a):** Treat as a structural dependency.
* **Usage (uses):** Treat as a functional dependency (+4).

---

## JavaScript Implementation Example

```javascript=1
// Global Scope
const u_time = Date.now();

        const getScaled = (val) => {
                                    return val/1000;
                                   }
    // Functional Dependency: main() depends on getScaled()
    function main() {
             let time = u_time;
              let factor = getScaled(time); // Data dependency `factor` on 'time'
               if (factor > 60) {
                 console.log("Threshold reached"); // Threshold event logging is controlled (fired) by `if()` header predicate `factor > 60`
               }
               const result = Math.floor(factor); // `if(){}` and `result` can be evaluted independently!
                return result; // return result depends on `result`!
    }

// Functional Dependency: window.addEventListener arrow function  depends on main()
window.addEventListener('click', 
        ////---------- Event Handler Isolation------------------
        () => {
                console.log("Page Clicked");
                 main(); // if `main()` will be executed too long then `console.log("Page Clicked")`  will be too late if their lines were rearranged!
              }
);
```
So we have in this code formatting "Functional Ladder" sheme:
```js
        const getScaled = (val) => {...}
    function main() {...}
window.addEventListener(..){...}
```

## Agent Verification Instructions (AI Skill)

When generating or analyzing code under **Dyuk Style**, follow these verification steps:

1. **Check Dependency Slope:** Is every line that uses a variable from the previous line shifted by 1 space? If not, the "Gantt"-like code flow is broken.
2. **Identify Call Hierarchy:** Are helper functions indented 4 spaces relative to their primary callers?
3. **Validate Async Isolation:** Are all `async` or `callback` functions pushed 8 spaces to the right?
4. **Detect Logic Bloat:** If the code drifts too far to the right (e.g., >40 spaces), flag this as a need for modularization or a new "spanning tree."

:::info
**Goal:** Simplicity of rules for simultaneous human/AI readability and rapid error detection in large volumes of generated code.
:::

## Deep Analysis of the "Dyuk Style" as an AI Prompt
By implementing this style, you transform your IDE from a text editor into a **Logic Analyzer**:

1.  **Structural Integrity:** AI-generated code is often "flat." Dyuk Style forces the AI to output the structure of its own logic. If the AI cannot maintain the correct indentation, it often indicates a flaw in its logical understanding of the variable scope.
2.  **The "Gantt" Effect:** In a standard JavaScript file, you cannot tell if `const a = b + c` is related to the code 10 lines above without reading it. In Dyuk Style, if that line is flush with the code 10 lines above, you *know* it is independent. If it is indented 10 spaces deeper, you know it is the end of a long calculation chain.
3.  **Error Detection:** This style makes "Dead Code" or "Logic Leaks" visible. If a variable is declared but the following lines don't indent, those lines aren't using that data.
4.  **Reviewing "Piles" of Code:** When an AI agent generates a 200-line script, you can scan the left margin. The "peaks" (flush left) are your entry points, and the "valleys" (indented code) are the implementation details.
