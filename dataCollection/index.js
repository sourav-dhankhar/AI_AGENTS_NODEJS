require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('@llamaindex/openai');
const { FunctionTool, OpenAIAgent } = require("llamaindex");

const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Initialize OpenAI LLM
const llm = new OpenAI({
    azure: {
        apiKey: process.env.API_KEY,
        endpoint: process.env.END_POINT
    },
    model: "gpt-4",
    temperature: 0
})

const session = {};

const systemPrompt = `
You are a voice chatbot for Deccan Interiors, a professional interior design service.You have ear to listen and mouth to speak. Your role is to assist customers by collecting essential details for an interior design consultation in a step-by-step manner. You will ask for and store the following: customer location (city or pincode), home location (if different), property type (apartment name or independent house), scope of work (full interior design or kitchen & wardrobes only), start date (timeline for the project), and contact info (full name and email ID). Use natural, polite language to guide the user through the process, interpret their responses accurately, and store the details via function tools. Maintain chat history and provide clear, concise responses to move the conversation forward.
## INSTRUCTIONS: 
- If the user input is a greeting (e.g., "Hi", "Hello", "Namaste"), respond with a warm greeting and prompt for the customer location or pincode using the collectDetails tool.
- Generate output for voice bot case.
- Don't use markdown in responses.
`;

// Function to manage the conversation flow and collect details
const collectDetails = async (input) => {
    const sessionId = input.sessionId;
    // Initialize session if not exists
    if (!session[sessionId]) {
        session[sessionId] = {
            collectedDetails: {
                customerLocation: null,
                homeLocation: null,
                propertyType: null,
                scopeOfWork: null,
                startDate: null,
                name: null,
                emailId: null,
                budgetConfirmation: null
            },
            chatHistory: [],
        };
    }

    const details = session[sessionId].collectedDetails;

    console.log('collectDetails details:: ', details)

    // Check each detail in sequence and return the appropriate prompt
    if (!details.customerLocation) {
        session[sessionId].currentTool = "collectCustomerLocation"
        return {
            message: "Hi, thank you for calling Deccan Interiors! Please let us know how we can assist you. We appreciate you reaching out to us. To start, could you please share your location or pincode?",
        };
    } else if (!details.homeLocation) {
        session[sessionId].currentTool = "collectHomeLocation"
        return {
            message: "Does the home Novak Djokovic have the same location or pincode? If not, can you please share the location and pin of the house you want interior design for? This will help us better understand where you are looking to design your interiors.",
        };
    } else if (!details.propertyType) {
        session[sessionId].currentTool = "collectPropertyType"
        return {
            message: "Could you let us know the name of your apartment or whether it's an independent house?",
        };
    } else if (!details.scopeOfWork) {
        session[sessionId].currentTool = "collectScopeOfWork"
        return {
            message: "What scope of work are you interested in for your interior design? a) Full Interior Design: Kitchen & wardrobes, fixed furniture (TV unit, Crockery unit, Study table, Pooja unit), loose furniture (Beds & Cots), and decorative elements (false ceiling, texture paint, etc.) b) Kitchen & Wardrobes Only",
        };
    } else if (!details.startDate) {
        session[sessionId].currentTool = "collectStartDate"
        return {
            message: "That’s great! Could you tell us when you’re looking to start the interiors? a) Less than 30 days b) 30 to 90 days c) Above 90 days",
        };
    } else if (!details.name || !details.emailId) {
        session[sessionId].currentTool = "collectContactInfo"
        return {
            message: "May I have your full name and email ID for our records?",
        };
    } else if (!details.budgetConfirmation) {
        session[sessionId].currentTool = "confirmBudget"
        return {
            message: `To get started on the right track, our initial budget for home interiors begins at ₹3 lakhs. Are you comfortable with this budget, and would you like to move forward with the next steps?
            Please respond in Yes and No`
        }
    } else {
        session[sessionId].currentTool = "complete"
        return {
            message: `Thank you for sharing the initial details with us. Our design expert will get in touch with you shortly today itself to discuss further.  We look forward to helping you bring your interior design ideas to life in your budget!
            Respond with following details of user in confirmation way : ${JSON.stringify(session[sessionId].collectedDetails)}
            Thanks again,
            Team Deccan`,
        };
    }
};

const collectDetailsTool = (sessionId) => FunctionTool.from(
    collectDetails,
    {
        name: "collectDetails",
        description: `Collects customer details for interior design consultation in a step-by-step manner.`,
        parameters: {
            type: "object",
            properties: {
                message: { type: "string", description: "The user's input message" },
                sessionId: { type: "string", description: "Unique session identifier" },
            },
            required: ["sessionId"],
        }
    }
);

// Function tools to store each piece of information, relying on LLM to interpret
const collectCustomerLocation = FunctionTool.from(
    async (input) => {
        const { value, sessionId } = input;
        console.log('collectCustomerLocation:: ', input,", ", session[sessionId])
        if (session[sessionId].collectedDetails) session[sessionId].collectedDetails.customerLocation = value;
        return await collectDetails({sessionId: sessionId})
    },
    {
        name: "collectCustomerLocation",
        description: "Stores the customer's location or pincode as interpreted by the LLM",
        parameters: {
            type: "object",
            properties: {
                value: { type: "string", description: "The customer's valid location or valid pincode (e.g., 'Bangalore, 560001')" },
                sessionId: { type: "string", description: "Unique session identifier" },
            },
            required: ["value", "sessionId"],
        },
    }
);

const collectHomeLocation = FunctionTool.from(
    async (input) => {
        const { value, sessionId } = input;
        console.log('collectHomeLocation:: ', input,", ", session[sessionId])
        if (session[sessionId].collectedDetails) {
            if (value.toLowerCase() == 'same') {
                session[sessionId].collectedDetails.homeLocation = session[sessionId].collectedDetails.customerLocation;
            } else {
                session[sessionId].collectedDetails.homeLocation = value;
            }
        }
        return await collectDetails({sessionId: sessionId})
    },
    {
        name: "collectHomeLocation",
        description: "Stores the location or pincode of the home for interior design as interpreted by the LLM",
        parameters: {
            type: "object",
            properties: {
                value: { type: "string", description: "The valid home location or valid pincode, or 'same' if identical to customer location" },
                sessionId: { type: "string", description: "Unique session identifier" },
            },
            required: ["value", "sessionId"],
        },
    }
);

const collectPropertyType = FunctionTool.from(
    async (input) => {
        const { value, sessionId } = input;
        console.log('collectPropertyType:: ', input,", ", session[sessionId])
        if (session[sessionId].collectedDetails) session[sessionId].collectedDetails.propertyType = value;
        return await collectDetails({sessionId: sessionId})
    },
    {
        name: "collectPropertyType",
        description: "Stores the property type (e.g., apartment name or 'independent house') as interpreted by the LLM",
        parameters: {
            type: "object",
            properties: {
                value: { type: "string", description: "The property type, such as apartment (apartment name not just 'apartment' word) or 'independent house'" },
                sessionId: { type: "string", description: "Unique session identifier" },
            },
            required: ["value", "sessionId"],
        },
    }
);

const collectScopeOfWork = FunctionTool.from(
    async (input) => {
        const { value, sessionId } = input;
        console.log('collectScopeOfWork:: ', input,", ", session[sessionId])
        if (session[sessionId].collectedDetails) session[sessionId].collectedDetails.scopeOfWork = value;
        return await collectDetails({sessionId: sessionId})
    },
    {
        name: "collectScopeOfWork",
        description: "Stores the scope of work for interior design as interpreted by the LLM",
        parameters: {
            type: "object",
            properties: {
                value: { type: "string", description: "The scope of work, e.g., 'Full Interior Design' or 'Kitchen & Wardrobes Only'" },
                sessionId: { type: "string", description: "Unique session identifier" },
            },
            required: ["value", "sessionId"],
        },
    }
);

const collectStartDate = FunctionTool.from(
    async (input) => {
        const { value, sessionId } = input;
        console.log('collectStartDate:: ', input,", ", session[sessionId])
        if (session[sessionId].collectedDetails) session[sessionId].collectedDetails.startDate = value;
        return await collectDetails({sessionId: sessionId})
    },
    {
        name: "collectStartDate",
        description: "Stores the timeline for starting the interior design project as interpreted by the LLM",
        parameters: {
            type: "object",
            properties: {
                value: { type: "string", description: "The start timeline, e.g., 'Less than 30 days', '30 to 90 days', or 'Above 90 days'" },
                sessionId: { type: "string", description: "Unique session identifier" },
            },
            required: ["value", "sessionId"],
        },
    }
);

const collectContactInfo = FunctionTool.from(
    async (input) => {
        const { name, emailId, sessionId } = input;
        console.log('collectContactInfo:: ', input,", ", session[sessionId])

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailId || typeof emailId !== "string" || !emailRegex.test(emailId)) {
            return "Invalid email address. Please provide a valid email, e.g., 'sd12@gmail.com'."
        }

        console.log('collectContactInfo:: ', input, ", ", session[sessionId]);

        if (session[sessionId] && session[sessionId].collectedDetails) {
            session[sessionId].collectedDetails.name = name;
            session[sessionId].collectedDetails.emailId = emailId;
        } else {
            return "Session not found or collectedDetails not initialized for sessionId: " + sessionId
        }

        return await collectDetails({ sessionId: sessionId });
    },
    {
        name: "collectContactInfo",
        description: "Stores the customer's full name and email ID as interpreted by the LLM",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Valid full name e.g., 'Sunny Dhankhar'" },
                emailId: { type: "string", description: "Valid email ID, e.g., 'sd12@gmail.com'. Must follow format: local-part@domain, no spaces, letters/numbers/special chars allowed, valid domain (e.g., .com, .org)." },
                sessionId: { type: "string", description: "Unique session identifier" },
            },
            required: ["name", "emailId", "sessionId"],
        },
    }
);

const confirmBudget = FunctionTool.from(
    async (input) => {
        const { value, sessionId } = input;
        console.log('confirmBudget:: ', input,", ", session[sessionId])
        
        if (session[sessionId].collectedDetails) {
            session[sessionId].collectedDetails.budgetConfirmation = value
        }

        if (value.toLowerCase() == "yes") {
            return await collectDetails({sessionId: sessionId})
        } else {
            return "Thank you for letting us know. We’ll get in touch to discuss budget options and see how we can assist you further."
        }
    },
    {
        name: "confirmBudget",
        description: "Confirms if the customer is comfortable with the initial budget of ₹3 lakhs as interpreted by the LLM",
        parameters: {
            type: "object",
            properties: {
                value: { type: "string", description: "The budget confirmation, e.g., 'Yes' or 'No'" },
                sessionId: { type: "string", description: "Unique session identifier" },
            },
            required: ["value", "sessionId"],
        },
    }
);


const agent = new OpenAIAgent({
    llm: llm,
    tools: [
        collectDetailsTool("placeholder"),
        collectCustomerLocation,
        collectHomeLocation,
        collectPropertyType,
        collectScopeOfWork,
        collectStartDate,
        collectContactInfo,
        confirmBudget,
    ]
});

app.post('/api/chat', async (req, res) => {
    try {
        const { sessionId, message } = req.body;

        if (!sessionId || !message) {
            return res.status(400).json({ error: "sessionId and message are required" });
        }

        // Initialize session if not exists
        if (!session[sessionId]) {
            session[sessionId] = {
                collectedDetails: {
                    customerLocation: null,
                    homeLocation: null,
                    propertyType: null,
                    scopeOfWork: null,
                    startDate: null,
                    name: null,
                    emailId: null,
                    budgetConfirmation: null
                },
                chatHistory: [],
                currentTool: "collectDetails",
            };
        }

        const currentTool = session[sessionId].currentTool;
        const chatHistory = session[sessionId].chatHistory;

        const tools = [
            collectDetailsTool(sessionId),
            collectCustomerLocation,
            collectHomeLocation,
            collectPropertyType,
            collectScopeOfWork,
            collectStartDate,
            collectContactInfo,
            confirmBudget,
        ];

        // Process the user message with chat history
        const response = await agent.chat({
            message: message,
            tools: [tools],
            additionalInstructions: `SESSION ID: ${sessionId}`,
            chatHistory: [
                {
                    role: "system",
                    content: `
                    ${systemPrompt}. 
                    Session ID : ${sessionId}
                    Function Tool To Call: ${currentTool}
                `
                },
                ...chatHistory.slice(-4).map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            ]
        });

        // console.log('response:: ', response)

        // Update chat history
        session[sessionId].chatHistory.push({ role: "user", content: message });
        session[sessionId].chatHistory.push({ role: "assistant", content: response.message.content });


        console.log('collectedDetails, nextStep::: ', session[sessionId].collectedDetails, ", ", session[sessionId].currentTool)

        // if (session[sessionId].currentTool == 'complete') {
        //     delete session[sessionId]
        // }

        const result = {
            response: response.message.content,
        };

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

