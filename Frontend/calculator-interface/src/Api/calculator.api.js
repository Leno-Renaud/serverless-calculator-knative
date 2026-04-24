export function calculate(expression) {
    try{
        const response = await fetch("http://ip:3000/calculate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ expression })
        })
        const data = await response.json()
        return data
    } 
    catch (error) {
        console.error("Error calculating expression:", error)
        throw error
    }
}