/**
 * If you enter a condition as a string like `${variable} !== null`, 
 * ASSERT will check that condition is true, and throw ASSERT ERROR if it is false.
 * */
export function ASSERT(condition) {
    if (!eval(condition)) {
        throw `ASSERT ERROR : ${condition}`;
    }
}