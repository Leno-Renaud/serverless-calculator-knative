export async function calculate(expression) {
    try{
        const response = await fetch("http://localhost:3000/calculate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ expression })
        })
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        return data
    } 
    catch (error) {
        console.error("Error calculating expression:", error)
        throw error
    }
}