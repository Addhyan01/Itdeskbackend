async function analyzeIssue(description){

const { GoogleGenAI } = await import("@google/genai")

const ai = new GoogleGenAI({
apiKey: process.env.GEMINI_API_KEY
})

const response = await ai.models.generateContent({

model: "gemini-flash-latest",

contents: `You are an IT helpdesk assistant.

A non-technical employee is facing an issue.

Analyze the problem and respond in VERY SIMPLE language.

Rules:
- Assume the user has little technical knowledge
- Give short step-by-step instructions
- Maximum 5 steps
- Each step should be easy to follow

Issue:
${description}

Return ONLY JSON format:

{
 "category":"",
 "priority":"",
 "solution":[]
}`

})

let text = response.text

// remove markdown if AI returns ```json
text = text.replace(/```json/g,"").replace(/```/g,"").trim()

const parsed = JSON.parse(text)

return parsed

}

module.exports = analyzeIssue