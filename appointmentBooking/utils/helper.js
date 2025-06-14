const { DateTime } = require('luxon');

function parseDate(relativeDate) {
    const today = DateTime.now(); // Get current date with Luxon

    if (relativeDate.toLowerCase() === "today") {
        return today.toISODate(); // Returns the current date in YYYY-MM-DD format
    } else if (relativeDate.toLowerCase() === "tomorrow") {
        return today.plus({ days: 1 }).toISODate(); // Returns tomorrow's date in YYYY-MM-DD format
    } else {
        try {
            // Try to parse the custom date in 'YYYY-MM-DD' format
            const parsedDate = DateTime.fromISO(relativeDate);
            if (!parsedDate.isValid) {
                throw new Error("Invalid date format");
            }
            return parsedDate.toISODate(); // Return the parsed date in 'YYYY-MM-DD' format
        } catch (err) {
            throw new Error("Invalid date format. Use 'today', 'tomorrow', or 'YYYY-MM-DD'");
        }
    }
}

module.exports = { parseDate }