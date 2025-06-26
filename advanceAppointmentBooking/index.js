require('dotenv').config();
const { OpenAI } = require('@llamaindex/openai');
const { FunctionTool, OpenAIAgent } = require("llamaindex");

const llm = new OpenAI({
    azure: {
        apiKey: process.env.API_KEY,
        endpoint: process.env.END_POINT
    },
    model: "gpt-4",
    temperature: 0
})


const sessions = {};

const appointments = {};

const tools = [
    FunctionTool.from(
        updateAppointmentDetails,
        {
            name: 'updateAppointmentDetails',
            description: 'It saves user information.',
            parameters: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', description: 'User sessionId' }
                },
                required: ['sessionId']
            }
        }
    ),
    FunctionTool.from(
        confirmAppointment,
        {
            name: 'confirmAppointment',
            description: 'It is called immediatley after user select the slots for appointment, it saves user information and return a message.',
            parameters: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', description: 'User sessionId' }
                },
                required: ['sessionId']
            }
        }
    ),
    FunctionTool.from(
        greetingPrompt,
        {
            name: 'greetingPrompt',
            description: 'It returns a greeting prompt, when user greet or request for options of services.',
            parameters: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', description: 'User sessionId' }
                },
                required: ['sessionId']
            }
        }
    ),
    FunctionTool.from(
        checkAppointment,
        {
            name: 'checkAppointment',
            description: 'Check if the user has an existing appointment using their sessionId. Invoke this immediately after the user selects a language or explicitly requests to check their appointment status (e.g., "check my appointment").',
            parameters: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', description: 'User sessionId' }
                },
                required: ['sessionId']
            }
        }
    ),
    FunctionTool.from(
        loadDepartment,
        {
            name: 'loadDepartment',
            description: 'Fetch a list of available departments for appointment booking. Invoke this when the user confirms they want to book an appointment.',
            parameters: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', description: 'User sessionId' }
                },
                required: ['sessionId']
            }
        }
    ),
    FunctionTool.from(
        loadDoctorData,
        {
            name: 'loadDoctorData',
            description: 'When user provides doctor name to book an appointment then retrieves a list of doctor data to book an appointment associated with the provided doctor name. Returns an array of objects, each containing doctor data.',
            parameters: {
                type: 'object',
                properties: {
                    doctorName: { type: 'string', description: 'Name of the doctor provided by user for appointment.' }
                },
                required: ['doctorName']
            }
        }
    ),
    FunctionTool.from(
        loadDepartmentData,
        {
            name: 'loadDepartmentData',
            description: 'When user provides a department name then retrieves a list of department data to book an appointment associated with the provided department. Returns an array of objects, each containing doctor data.',
            parameters: {
                type: 'object',
                properties: {
                    departmentName: { type: 'string', description: 'Name of department provided by user for appointment.' }
                },
                required: ['departmentName']
            }
        }
    ),
    FunctionTool.from(
        loadSymptomData,
        {
            name: 'loadSymptomData',
            description: 'When user provides symptoms then retrieves a list of symptom data to book an appointment associated with the provided symptoms. Returns an array of objects, each containing doctor data.',
            parameters: {
                type: 'object',
                properties: {
                    symptomName: { type: 'string', description: 'Symptom name provided by user for appointment.' }
                },
                required: ['symptomName']
            }
        }
    ),
    FunctionTool.from(
        changeLanguage,
        {
            name: 'changeLanguage',
            description: 'It changes language given by user, and returns true upon updating successfully.',
            parameters: {
                type: 'object',
                properties: {
                    language: { type: 'string', description: 'User Language' },
                    sessionId: { type: 'string', description: 'Session Id' }
                },
                required: ['language', 'sessionId']
            }
        }
    ),
    FunctionTool.from(
        removeAppointment,
        {
            name: 'removeAppointment',
            description: 'It removes appointment details, and returns message upon deleting successfully.',
            parameters: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', description: 'Session Id' }
                },
                required: ['sessionId']
            }
        }
    ),
];

const agent = new OpenAIAgent({
    llm: llm,
    tools: tools
});

// Doctor data (can be fetched from MongoDB dynamically)

function areInstructionsComplete(userData) {
    return !!(
        userData.doctorName &&
        userData.department &&
        userData.userLanguage &&
        userData.appointmentTime
    );
}

async function extractDataFromConversation(chatHistory, userData) {
    const conversationText = chatHistory.length ? chatHistory.map((msg) => `${msg.role}: ${msg.content}`).join('\n') : [];
    // console.log('conversationText:: ', conversationText)
    // console.log('extractDataFromConversation userData:: ', userData)
    const prompt = `Extract from conversation: doctorName (if confirmed), department (if confirmed), appointmentTime (if confirmed), symptom (if confirmed), paymentConfirmed (paid if confirmed, not paid if not paid), userLanguage (when specified language), checkIn (user checkIn progress (check-in, not-check-in) and one more thing, appointment checking is not checkIn process FYI checkIn is different than check book appointment), if any data is empty from conversation keep as it is data from userData: ${JSON.stringify(userData)}. Generate a valid JSON response. Conversation:\n${conversationText}`;
    const response = await llm.complete({ prompt });
    // console.log('extract response:: ', response)
    try {
        return JSON.parse(response.text);
    } catch (e) {
        console.error('Failed to parse LLM response:', response.text);
        return {};
    }
}

function removeAppointment(params) {
    console.log('removeAppointment:: ', params, ", ", sessions[params.sessionId]);
    if (appointments[params.sessionId]) {
        delete appointments[params.sessionId]
    }
    if (sessions[params.sessionId]) {
        delete sessions[params.sessionId]
    }
    return "Data deleted successfully"
}

function loadDepartment(params) {
    console.log('load department is called:: ', params);
    return ['Orthopedics', 'Neurology', 'Cardiology'];
}

function greetingPrompt(params) {
    console.log("greetingPrompt is called:: ", params)
    return "Hello! I'm XYZ_hospital's Virtual Health Assistant, here to make your experience smoother and more personal. I can help with appointments and check-in. What brings you to XYZ_hospital? I'm designed to make things easier, so you don't have to navigate everything on your own."
}

function changeLanguage(params) {
    console.log('changeLanguage:: ', params);
    if (appointments[params.sessionId]) {
        appointments[params.sessionId].userLanguage = params.language
    }
    return true
}

function confirmAppointment(params) {
    console.log('confirmAppointment is called :: ', params)
    const session = sessions[params.sessionId]
    const isComplete = areInstructionsComplete(session.userData);
    if (isComplete) {
        appointments[params.sessionId] = session.userData
        return "Great news! Your appointment is all confirmed for [slot] with [doctor] in [department], OPD Block B. I'll send you a gentle reminder [dateTime] with some helpful preparation tips. You want to make payment now or later ?"
    }
    return false
}

function updateAppointmentDetails({ sessionId }) {
    console.log('Update appointment details:: ', sessions, sessionId);
    const session = sessions[sessionId]
    if (appointments[sessionId]) {
        appointments[sessionId] = session.userData
    }
    return true
}

function checkAppointment({ sessionId }) {
    console.log('appointments[sessionId]:: ', appointments, ", ", sessionId)
    console.log('session details[sessionId]:: ', sessions)
    if (appointments[sessionId]) {
        return appointments[sessionId]
    } else {
        return null
    }
}

async function loadDoctorData(params) {
    console.log('loadDoctor data:: ', params)
    const mockDoctors = [
        {
            name: 'Dr. Vikram Sharma', specialization: 'knee conditions', department: 'Orthopedics', availableSlots: [
                { day: 'Tomorrow', time: '10:30 AM' },
                { day: 'Tomorrow', time: '2:15 PM' }
            ]
        },
        {
            name: 'Dr. Meera Patel', specialization: 'sports injuries and joint pain', department: 'Orthopedics', availableSlots: [
                { day: 'Thursday', time: '11:45 AM' },
                { day: 'Friday', time: '9:00 AM' }
            ]
        },
        {
            name: 'Dr. Anurag Patel', specialization: 'Heart specialist', department: 'Cardiologist', availableSlots: [
                { day: 'Tomorrow', time: '10:30 AM' },
                { day: 'Tomorrow', time: '2:15 PM' }
            ]
        },
        {
            name: 'Dr. Shubham kumar', specialization: 'brain specialist', department: 'Neurology', availableSlots: [
                { day: 'Thursday', time: '11:45 AM' },
                { day: 'Friday', time: '9:00 AM' }
            ]
        }
    ];
    // return mockDoctors.filter(d => d.specialization.toLowerCase().includes(query.toLowerCase()));
    return mockDoctors
}

function loadSymptomData(params) {
    console.log('loadSymptomData data:: ', params)
    const mockDoctors = [
        {
            name: 'Dr. Vikram Sharma', specialization: 'knee conditions', department: 'Orthopedics', availableSlots: [
                { day: 'Tomorrow', time: '10:30 AM' },
                { day: 'Tomorrow', time: '2:15 PM' }
            ]
        },
        {
            name: 'Dr. Meera Patel', specialization: 'sports injuries and joint pain', department: 'Orthopedics', availableSlots: [
                { day: 'Thursday', time: '11:45 AM' },
                { day: 'Friday', time: '9:00 AM' }
            ]
        },
        {
            name: 'Dr. Anurag Patel', specialization: 'Heart specialist', department: 'Cardiologist', availableSlots: [
                { day: 'Tomorrow', time: '10:30 AM' },
                { day: 'Tomorrow', time: '2:15 PM' }
            ]
        },
        {
            name: 'Dr. Shubham kumar', specialization: 'brain specialist', department: 'Neurology', availableSlots: [
                { day: 'Thursday', time: '11:45 AM' },
                { day: 'Friday', time: '9:00 AM' }
            ]
        }
    ];
    // return mockDoctors.filter(d => d.specialization.toLowerCase().includes(query.toLowerCase()));
    return mockDoctors
}

function loadDepartmentData(params) {
    console.log('loadDepartmentData data:: ', params)
    const mockDoctors = [
        {
            name: 'Dr. Vikram Sharma', specialization: 'knee conditions', department: 'Orthopedics', availableSlots: [
                { day: 'Tomorrow', time: '10:30 AM' },
                { day: 'Tomorrow', time: '2:15 PM' }
            ]
        },
        {
            name: 'Dr. Meera Patel', specialization: 'sports injuries and joint pain', department: 'Orthopedics', availableSlots: [
                { day: 'Thursday', time: '11:45 AM' },
                { day: 'Friday', time: '9:00 AM' }
            ]
        },
        {
            name: 'Dr. Anurag Patel', specialization: 'Heart specialist', department: 'Cardiologist', availableSlots: [
                { day: 'Tomorrow', time: '10:30 AM' },
                { day: 'Tomorrow', time: '2:15 PM' }
            ]
        },
        {
            name: 'Dr. Shubham kumar', specialization: 'brain specialist', department: 'Neurology', availableSlots: [
                { day: 'Thursday', time: '11:45 AM' },
                { day: 'Friday', time: '9:00 AM' }
            ]
        }
    ];
    // return mockDoctors.filter(d => d.specialization.toLowerCase().includes(query.toLowerCase()));
    return mockDoctors
}

async function processInput(sessionId, userInput) {
    let session = sessions[sessionId] || { chatHistory: [], userData: { sessionId }, symptomCapture: [], paymentChat: [] };

    const appointmenDetails = checkAppointment({ sessionId: sessionId })

    if (appointmenDetails && appointmenDetails['checkIn'] != 'check-in') {
        if (session.paymentChat.length == 0) {
            const lastMessages = session.chatHistory.slice(-4)
            session.paymentChat = [...lastMessages]
        }
        session.paymentChat.push({ role: 'user', content: userInput, timestamp: new Date().toISOString() });
        session.userData = { ...session.userData, ...await extractDataFromConversation(session.paymentChat, session.userData) }
    }
    else if (appointmenDetails && appointmenDetails['checkIn'] == 'check-in') {
        // Step 1: Perform sentiment analysis using LLM
        let sentimentResult = { polarity: 'neutral', score: 0.0 }; // Default sentiment
        try {
            if (session.symptomCapture.length) {
                let prompt = `Analyze the sentiment of the input text. Generate a valid JSON response with "polarity" (positive, negative, or neutral) and "score" (confidence between 0 and 1). Example: { "polarity": "positive", "score": 0.8 }
                QUESTION ASKED TO USER: ${session.symptomCapture[session.symptomCapture.length - 1].content}
                USER INPUT: ${userInput}
                `
                const sentimentResponse = await llm.complete({ prompt })

                console.log('sentimentResponse:: ', sentimentResponse)

                // Parse the LLM response (assuming it returns JSON string or object)
                sentimentResult = JSON.parse(sentimentResponse.text || '{"polarity": "neutral", "score": 0.0}');
            }
        } catch (error) {
            console.error('Sentiment analysis failed:', error);
            // Fallback to default sentiment if LLM fails
        }

        // Step 2: Add user input and sentiment to symptomCapture
        session.symptomCapture.push({
            role: 'user',
            content: userInput,
            timestamp: new Date().toISOString(),
            sentiment: sentimentResult // Store sentiment (e.g., { polarity: "positive", score: 0.8 })
        });

        session.userData = { ...session.userData, ...await extractDataFromConversation(session.symptomCapture, session.userData) };

        userInput = userInput + ". Sentiment analysis of this input is:: " + JSON.stringify(sentimentResult)
    } else {
        // Extract data from conversation
        session.chatHistory.push({ role: 'user', content: userInput, timestamp: new Date().toISOString() });
        session.userData = { ...session.userData, ...await extractDataFromConversation(session.chatHistory, session.userData) }
    }

    // Calculate missing fields
    const requiredFields = ['doctorName', 'userLanguage'];
    const missingFields = requiredFields.filter(field => !session.userData[field]);

    // Check if instructions are complete
    const isComplete = areInstructionsComplete(session.userData);

    console.log('isComplete:: ', isComplete);

    // Process main response
    let response = '';

    // console.log('appointmenDetails:: ', appointmenDetails)

    if (!appointmenDetails) {
        console.log('no appointment details:: ', appointmenDetails)
        response = await agent.chat({
            message: userInput,
            additionalInstructions: JSON.stringify({
                userData: session.userData,
                missingFields: missingFields.join(', ')
            }),
            chatHistory: [
                {
                    role: 'system', content: `
                    ## Intro: You are XYZ_hospital's multilingual Virtual Health Assistant, designed to engage patients warmly and make their experience smoother for only booking appointment and checking appointment. Collect: doctorName, department, appointment time, language preference\n
                    ## User input: ${userInput}
                    ## Current user data: ${JSON.stringify(session.userData)}
                    ## Missing: ${missingFields || 'None'}
                    ## Intents:
                        - if user wants to change language , change the language , call (updateAppointmentDetails tool ): To update the confirmation and **repeat the last message**.
                        - if user wants to remove appointment , call (removeAppointment tool): To remove the appointment. 
                        - if user wants to check appointment status.
                           - If current session user data exist , then show this data to user , otherwise ask user to book new appointment. 
                    ## Instructions :
                        Follow this flow naturally one by one step, keeping the tone reassuring and conversational, using the conversation history from messages ensuring missing details should be 'None'. **Ensure to provide information using respective function calls , not outside of that scope**:
                            1. **If user input is more like greeting**: call (greetingPrompt tool with {sessionId: ${sessionId}}) and get the greeting message, show its content use current user data also if details exist to make greeting more interactive and wait for user response.
                            2. If user wants to checkIn then ask user to complete the booking first, to move to checkIn process.
                            2. **If  user input is more like ending conversation (Like "thanks", "thanx")**:
                            - If confirm appointment is left , prompt user to confirm his appointment.
                            - If user details are left to book appointment , prompt user to continue with his appointment.
                            3. **If language not selected**, ask user to select the language to make further conversation, wait for user.
                            5. On language selection
                            - If user already provided "doctor name", **no need to ask ("department name", "symptom" and "appointment time"), or no need to refine the appointment details, I repeat no need to ask**, call (loadDoctorData functionTool {doctorName: ${session.userData.doctorName}}) and present data to user on the basis of doctorname only.
                            - If user already provided "department name", **no need to ask ("doctor name" and "symptom" and "appointment time"), or no need to refine the appointment details, I repeat no need to ask)**, call (loadDepartmentData {departmentName: ${session.userData.departmentName}}) and present data to user on the basis of department name only.
                            - If user already provided "symptom", **no need to ask ("doctor name", "department name" and "appointment time"), or no need to refine the appointment details, I repeat no need to ask)**, call (loadSymptomData {symptomName: ${session.userData.symptom}}) and present data to user on the basis of symptom only.
                            - If all ((doctor name (${session.userData.doctorName}) / any symptom (${session.userData.symptom}) / department name (${session.userData.department})) details**) is empty in above mentioned current user data.
                                    - call (loadDepartment tool), show the department list to the user to select and also ask if user have any symptom or doctor name in mind and wait for user.
                            - If tool response not matched with user given data to filter out , apologize , call (loadDepartment tool) and wait for the user.
                            - Use given details to call function tools , rather than asking other details.
                            6. On slot selection of user.
                                6.1 If slot selection is fine, prompt user to confirm his appointment along with respective details.
                                6.2 If slot selections is not fine , prompt user for slot slection : "Available timings" and wait for user.
                            7. Upon confirmation of appointment: call (confirmAppointment tool {sessionId: ${sessionId}}) and show success message to user.
                            8. If user does not agree to confirm the appointment , prompt them to edit details.
                            9. Ensure user confirms the appointment after prompting for appointment confirmation, otherwise keep asking user to confirm his appointment before moving further.
                        - confirmAppointment: To confirm the appointment of the user.
                        - greetingPrompt: When user greet or ask for services.
                        - checkAppointment: When checking appointments.
                        - loadDepartment: Retrieves list of departments.
                        - loadDoctorData: When user gives doctor name.
                        - loadSymptomData: When user gives symptom.
                        - loadDepartmentData: When user gives department name.
                        Allow unrelated questions but guide toward missing details. Keep the tone warm and patient-centric.
                        Generate output in ${session.userData.userLanguage || 'English'} with markdowns to represent data in best format for whatsapp messages.
                        `}
                , ...session.chatHistory.slice(0, -1).slice(-6).map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))]
        });
        session.chatHistory.push({ role: 'assistant', content: response.message.content, timestamp: new Date().toISOString() });
    } else if (appointmenDetails && (appointmenDetails['paymentConfirmed'] != 'paid')) {
        console.log('pay now details:: ', appointmenDetails, ", ", session.userData)
        response = await agent.chat({
            message: userInput,
            additionalInstructions: JSON.stringify({
                userData: session.userData,
                missingFields: missingFields.join(', ')
            }),
            chatHistory: [
                {
                    role: 'system', content: `
                    ## Intro: You are XYZ_hospital's multilingual Virtual Health Assistant, designed to engage patients warmly and make their experience smoother for only payment update and checking appointment.
                    ## User input: ${userInput}
                    ## Current User Details: ${JSON.stringify(session.userData)}
                    ## Appointment Details: ${JSON.stringify(appointmenDetails)}
                    ## Intents:
                        - if user wants to change language , change the language , Invoke \`call (changeLanguage functionTool)\` to update language change and **repeat the last message**.
                        - if user wants to remove appointment , call (removeAppointment tool): To remove the appointment.
                        - if user wants to check appointment status Invoke \`call (checkAppointment functionTool { sessionId: "${sessionId}" })\` and show data to user for their appointment.
                    ## Instructions :
                        Follow this flow naturally one by one step, keeping the tone reassuring and conversational, using the conversation history from messages:
                            1. **If user input is more like ending conversation (Like "thanks", "thanx")**: Respond user in welcoming state.
                            2. **If user input is more like greeting**: Respond with greetings: "I see you have an appointment with [doctor] in [department] on [time]."
                            3. If user wants to checkIn and (session.userData.paymentConfirmed && appointmenDetails.paymentConfirmed) payment not done, prompt for payment Messages : "Pay Now", "Pay Later" as payment is necessary before check in and wait for user.
                            4. If user not checking in and (session.userData.paymentConfirmed && appointmenDetails.paymentConfirmed) payment not done, ask user to pay with this message: " I could help you complete the payment now, which would save you considerable time at the reception [appointmentTime] and wait for user and also prompt for payment Messages : "Pay Now", "Pay Later" and wait for user.
                            5. If user wants to make payment or On selecting any payment options.
                            - Invoke \`call (updateAppointmentDetails functionTool { sessionId: "${sessionId}" })\` to update user information and prompt user to confirm the user.
                        - updateAppointmentDetails: To update the user information.
                        - checkAppointment: When checking appointments.
                        Allow unrelated questions but guide toward missing details. Keep the tone warm and patient-centric.
                        Generate output in ${session.userData.userLanguage || 'English'} with markdowns to represent data in best format for whatsapp messages.
                        `}
                , ...session.paymentChat.slice(0, -1).slice(-3).map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))]
        });
        session.paymentChat.push({ role: 'assistant', content: response.message.content, timestamp: new Date().toISOString() });
    } else if (appointmenDetails && (appointmenDetails['paymentConfirmed'] == 'paid' && appointmenDetails['checkIn'] != 'check-in')) {
        console.log('appointee checking in:: ', appointmenDetails, ", ", session.userData)
        response = await agent.chat({
            message: userInput,
            additionalInstructions: JSON.stringify({
                userData: session.userData,
                missingFields: missingFields.join(', ')
            }),
            chatHistory: [
                {
                    role: 'system', content: `

                    ## Intro: You are XYZ_hospital's multilingual Virtual Health Assistant, designed to engage patients warmly and make their experience smoother for payment for only payment update and checkin process.
                    ## User input: ${userInput}
                    ## Appointment Details: ${JSON.stringify(appointmenDetails)}
                    ## Intents:
                        - if user wants to change language , change the language , Invoke \`call (changeLanguage functionTool)\` to change user language and **repeat the last message**.
                        - if user wants to remove appointment , call (removeAppointment tool): To remove the appointment.
                        - if user wants to check appointment status Invoke \`call (checkAppointment functionTool { sessionId: "${sessionId}" })\` and show data to user for their appointment.
                    ## Instructions :
                        Follow this flow naturally one by one step, keeping the tone reassuring and conversational, using the conversation history from messages:
                            1. If appointment details 
                                1.1) If appointee paid the amount, respond with greetings: "I see you have an appointment with [doctor] in [department] on [time]. Welcome to XYZ_hospital! I see you've arrived for your appointment with [doctor] at [time]. How are you feeling today?

                                Would you like to check in now through this chat? It's a little convenience we've created to help you avoid standing
                                in the physical check-in line. You can relax in the waiting area instead." and wait for user.
                            2. Once user confirm to check in **Invoke \`call (updateAppointmentDetails functionTool { sessionId: "${sessionId}" })\` to update user information**, prompt appointee: "I've checked you in for your appointment - you're all set! Let me introduce you to your care team today:
                            [doctor] will be your consulting [department] specialist.

                            Nurse Priya will be assisting during your consultation. She's wonderful at explaining post-appointment care instructions.

                            Rahul is your Patient Care Associate today and can help with any logistical needs during your visit.
                            
                            [doctor] is currently with another patient, and your estimated wait time is about 15 minutes. While you're waiting to see [doctor], would you like to use this time to prepare for your consultation?".   
                        - updateAppointmentDetails: To update the user information.
                        - checkAppointment: When checking appointments.
                        Allow unrelated questions but guide toward missing details. Keep the tone warm and patient-centric.
                        Generate output in ${session.userData.userLanguage || 'English'} with markdowns to represent data in best format for whatsapp messages.
                        `}
                , ...session.paymentChat.slice(0, -1).slice(-3).map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))]
        });
        session.paymentChat.push({ role: 'assistant', content: response.message.content, timestamp: new Date().toISOString() });
    } else if (appointmenDetails && appointmenDetails['checkIn'] == 'check-in') {
        console.log('Process with questions:: ')
        console.log('appointee checking in:: ', appointmenDetails, ", ", session.userData)
        console.log('symptomCapture:: ', session.symptomCapture[session.symptomCapture.length - 1])
        response = await agent.chat({
            message: userInput,
            additionalInstructions: JSON.stringify({
                userData: session.userData,
                missingFields: missingFields.join(', ')
            }),
            chatHistory: [
                {
                    role: 'system', content: `
                    ## Intro: You are XYZ_hospital's multilingual Virtual Health Assistant, designed to engage patients warmly , you have user's appointment details prepare questions on the basis of given details and ask user.
                    ## User input: ${userInput}
                    ## Appointment Details: ${JSON.stringify(appointmenDetails)}
                    ## Intents:
                        - if user wants to change language , change the language , (updateAppointmentDetails tool ), to update user information and **repeat the last message**.
                        - if user wants to remove appointment , call (removeAppointment tool): To remove the appointment.
                    ## Instructions :
                        Follow this flow naturally one by one step, keeping the tone reassuring and conversational, using the conversation history from messages:
                            1. **If user input is more like ending conversation (Like "thanks", "thanx")**: Respond user in welcoming state.    
                            2. If appointment details 
                                2.1) Prompt user: "I could help you organize your thoughts. This makes your time with the doctor more productive, as everything is already prepared when you enter the consultation room. Are you ready for this?" and wait for the user.
                                2.2) Once user confirms, Ask user 4-5 valid questions which does not voilet content management policy, one by one and wait for user input to capture patient details in more detail, so that patient need not to tell basic questions infront of doctor [doctor], patientProblme [patientProblem], department [deparment].
                                2.3) Once all questions are done, generate a bullet points of the conversation so far with concised details of patient along with sentiment analysis report, and present it to patient along with telling that doctor [doctor] will find it helpful, once all .
                        Allow unrelated questions but guide toward missing details. Keep the tone warm and patient-centric.
                        Generate output in ${session.userData.userLanguage || 'English'} with markdowns to represent data in best format for whatsapp messages.
                        `}
                , ...session.symptomCapture.slice(0, -1).map(msg => {
                    // console.log('symptomCapture msg::', JSON.stringify(msg))
                    let obj = {
                        "role": msg.role,
                        "content": msg.sentiment ? msg.content + " Sentiment Ananlysis Data:: " + JSON.stringify(msg.sentiment) : msg.content
                    }
                    return obj
                }
                )]
        });
        session.symptomCapture.push({ role: 'assistant', content: response.message.content, timestamp: new Date().toISOString() });
    }

    // console.log('processInput response:: ', response);

    let botResponse = { type: 'text', text: '', choices: [] };

    // session.chatHistory.push({ role: 'assistant', content: botResponse.text, timestamp: new Date().toISOString() });


    sessions[sessionId] = session;
    return {
        response: response.message.content,
        query: userInput,
        tokensConsumed: '400',
        error: false
    }
}

module.exports = { processInput }