require('dotenv').config()
const { retrieveKidneyCareToolWrapper, LookupPatientInfo, BookAppointmentSlot, CancelKidneyCareAppointment, findBookedAppointment } = require('./controller/functionTool.js')
const { chromaVector } = require('./utils/chromaDB')
const { VectorStoreIndex, OpenAIEmbedding, OpenAI, PromptHelper, CallbackManager, OpenAIAgent, Settings, Groq, HuggingFaceInferenceAPIEmbedding, HuggingFaceInferenceAPI, SentenceSplitter } = require("llamaindex");

// const vectorStoreCache = new Map()

const LLM_TEMP = process.env.LLM_TEMPERATURE
const GROQ_ENDPOINT = process.env.GROQ_ENDPOINT
const HUGGINGFACE_ENDPOINT = process.env.HUGGINGFACE_ENDPOINT
const MAX_TOKENS = 500

const aiPlatformsFunction = (() => {
    let ai_platforms = [];

    // This is the closure, which retains the state of ai_platforms
    return async () => {
        if (ai_platforms.length === 0) {
            //It returns all the aiPLatforms
            //   ai_platforms = await fetchAIPlatoforms();
        }
        return ai_platforms;
    };
})();

function isJsonString(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    console.error('isJsonString error:: ', e)
    return false;
  }
  return true;
}

function get_today() {
  const todaysDate = new Date()
  return todaysDate.toLocaleDateString('en-CA');
}

async function getLLM(aiModelSettingsObj, zeroTemp = false) {
  let llm;
  let temperature = zeroTemp ? 0 : Number(aiModelSettingsObj.query.temperature) ?? Number(LLM_TEMP)
  switch (aiModelSettingsObj?.query?.platform) {
    case "OPENAI":
      if (aiModelSettingsObj?.query?.native) {
        let ai_platform = await aiPlatformsFunction()
        let openAIPlatform = ai_platform.find(platform => platform.abbr === 'OPENAI')
        llm = new OpenAI({
          apiKey: openAIPlatform.access_key,
          model: aiModelSettingsObj.query.llm,
          temperature: temperature,
          maxTokens: MAX_TOKENS
        })
        console.log('Native OPENAI LLM:: ', openAIPlatform)
      } else {
        llm = new OpenAI({
          apiKey: aiModelSettingsObj.query.access_key,
          model: aiModelSettingsObj.query.llm,
          temperature: temperature,
          maxTokens: MAX_TOKENS
        })
        console.log('Non-Native OPENAI LLM:: ')
      }
      break;
    case "AZURE":
      if (aiModelSettingsObj?.query?.native) {
        let ai_platform = await aiPlatformsFunction()
        let azurePlatform = ai_platform.find(platform => platform.abbr === 'AZURE')
        llm = new OpenAI({
          azure: {
            apiKey: azurePlatform.access_key,
            endpoint: azurePlatform.url
          },
          model: aiModelSettingsObj.query.llm,
          temperature: temperature,
          maxTokens: MAX_TOKENS
        })
        console.log('Native AZURE LLM:: ', azurePlatform)
      } else {
        llm = new OpenAI({
          azure: {
            apiKey: aiModelSettingsObj.query.access_key,
            endpoint: aiModelSettingsObj.query.url
          },
          model: aiModelSettingsObj.query.llm,
          temperature: temperature,
          maxTokens: MAX_TOKENS
        })
        console.log('Non-Native AZURE LLM:: ')
      }
      break;
    case "GROQ":
      if (aiModelSettingsObj?.query?.native) {
        let ai_platform = await aiPlatformsFunction()
        let groqPlatform = ai_platform.find(platform => platform.abbr === 'GROQ')
        llm = new Groq({
          additionalSessionOptions: {
            apiKey: groqPlatform.access_key,
            baseURL: groqPlatform.url ?? GROQ_ENDPOINT
          },
          model: aiModelSettingsObj.query.llm,
          temperature: temperature,
          maxTokens: MAX_TOKENS
        })
        console.log('Native GROQ LLM:: ', groqPlatform)
      } else {
        llm = new Groq({
          additionalSessionOptions: {
            apiKey: aiModelSettingsObj.query.access_key,
            baseURL: aiModelSettingsObj.query.url ?? GROQ_ENDPOINT
          },
          model: aiModelSettingsObj.query.llm,
          temperature: temperature,
          maxTokens: MAX_TOKENS
        })
        console.log('Non-Native GROQ LLM:: ')
      }
      break;
    case "HUGGINGFACE":
      if (aiModelSettingsObj?.query?.native) {
        let ai_platform = await aiPlatformsFunction()
        let huggingFacePlatform = ai_platform.find(platform => platform.abbr === 'HUGGINGFACE')
        llm = new HuggingFaceInferenceAPI({
          accessToken: huggingFacePlatform.access_key,
          model: aiModelSettingsObj.query.llm,
          endpoint: huggingFacePlatform.url,
          temperature: temperature,
          maxTokens: MAX_TOKENS
        })
        console.log('Native HUGGINGFACE LLM:: ', huggingFacePlatform)
      } else {
        llm = new HuggingFaceInferenceAPI({
          accessToken: aiModelSettingsObj.query.access_key,
          model: aiModelSettingsObj.query.llm,
          endpoint: aiModelSettingsObj.query.llm ?? HUGGINGFACE_ENDPOINT,
          temperature: temperature,
          maxTokens: MAX_TOKENS
        })
        console.log('Non-Native HUGGINGFACE LLM:: ')
      }
      break;
    default:
      let ai_platform = await aiPlatformsFunction()
      let groqPlatform = ai_platform.find(platform => platform.abbr === 'GROQ')
      llm = new Groq({
        additionalSessionOptions: {
          apiKey: groqPlatform.access_key,
          baseURL: groqPlatform.url
        },
        model: aiModelSettingsObj.query.llm,
        temperature: temperature,
        maxTokens: MAX_TOKENS
      })
      console.log('Native default LLM:: ', groqPlatform)
  }

  return llm
}

async function getEmbeddings(aiModelSettingsObj) {
  let embedding;
  switch (aiModelSettingsObj?.embedding?.platform) {
    case "OPENAI":
      if (aiModelSettingsObj?.embedding?.native) {
        let ai_platform = await aiPlatformsFunction()
        let openAIPlatform = ai_platform.find(platform => platform.abbr === 'OPENAI')
        embedding = new OpenAIEmbedding({
          apiKey: openAIPlatform.access_key,
          model: aiModelSettingsObj.embedding.model,
        })
        console.log('Native OPENAI Embedding:: ', openAIPlatform)
      } else {
        embedding = new OpenAIEmbedding({
          apiKey: aiModelSettingsObj.embedding.access_key,
          model: aiModelSettingsObj.embedding.model,
        })
        console.log('Non-Native OPENAI Embedding:: ')
      }
      break;
    case "AZURE":
      if (aiModelSettingsObj?.embedding?.native) {
        let ai_platform = await aiPlatformsFunction()
        let azurePlatform = ai_platform.find(platform => platform.abbr === 'AZURE')
        embedding = new OpenAIEmbedding({
          azure: {
            apiKey: azurePlatform.access_key,
            endpoint: azurePlatform.url
          },
          model: aiModelSettingsObj.embedding.model,
        });
        console.log('Native AZURE Embedding:: ', azurePlatform)
      } else {
        embedding = new OpenAIEmbedding({
          azure: {
            apiKey: aiModelSettingsObj.embedding.access_key,
            endpoint: aiModelSettingsObj.embedding.url
          },
          model: aiModelSettingsObj.embedding.model
        });
        console.log('Non-Native AZURE Embedding:: ')
      }
      break;
    case "HUGGINGFACE":
      if (aiModelSettingsObj?.embedding?.native) {
        let ai_platform = await aiPlatformsFunction()
        let huggingFacePlatform = ai_platform.find(platform => platform.abbr === 'HUGGINGFACE')
        embedding = new HuggingFaceInferenceAPIEmbedding({
          accessToken: huggingFacePlatform.access_key,
          model: aiModelSettingsObj.embedding.model,
          endpoint: huggingFacePlatform.url
        })
        console.log('Native HUGGINGFACE Embedding:: ', huggingFacePlatform)
      } else {
        embedding = new HuggingFaceInferenceAPIEmbedding({
          accessToken: aiModelSettingsObj.embedding.access_key,
          model: aiModelSettingsObj.embedding.model,
          endpoint: huggingFacePlatform.embedModel.url ?? HUGGINGFACE_ENDPOINT
        })
        console.log('Non-Native HUGGINGFACE Embedding:: ')
      }
      break;
    default:
      let ai_platform = await aiPlatformsFunction()
      let huggingFacePlatform = ai_platform.find(platform => platform.abbr === 'HUGGINGFACE')
      embedding = new HuggingFaceInferenceAPIEmbedding({
        accessToken: huggingFacePlatform.access_key,
        model: aiModelSettingsObj.embedding.model,
        endpoint: huggingFacePlatform.url
      })
      console.log('Native default Embedding:: ', huggingFacePlatform)
  }
  return embedding
}


// Call this function
// It is appointment booking bot + knowledge base
// question: Question which user ask
// context: chat history with user and assistant label keep last 4-6 chat histories
// prompt: PERSONA + INSTRUCTIONS
// aiModelSettings: it is an object which have llm type, embed type, vectordatabase type, then find its credentials
async function bookKidneyCareAppointment(question, context, prompt, providedData, aiModelSettings) {
  console.log('Booking Appointment')
  const aiModelSettingsObj = isJsonString(aiModelSettings) ? JSON.parse(aiModelSettings) : false
  let output
  try {
    const startTime = new Date();
    if (aiModelSettingsObj) {
      switch (aiModelSettingsObj.vector_db.type) {
        case "chromadb":
          console.log("------ BookKidneyCareAppointment Time Calculation starts here ------")
          const llm = await getLLM(aiModelSettingsObj)
          const promptHelper = new PromptHelper()
          const callbackManager = new CallbackManager()
          const nodeParser = new SentenceSplitter({
            chunkSize: 256,
            chunkOverlap: 50
          })
          const embedModel = await getEmbeddings(aiModelSettingsObj)
          const vectorStore = await chromaVector(aiModelSettingsObj.vector_db, embedModel);

          Settings.llm = llm
          Settings.embedModel = embedModel
          Settings.promptHelper = promptHelper
          Settings.callbackManager = callbackManager
          Settings.nodeParser = nodeParser

          const loadedIndex = await VectorStoreIndex.fromVectorStore(vectorStore);
          const loadedQueryEngine = loadedIndex.asQueryEngine();
          const parsedContext = JSON.parse(context)

          let userPrompt = '';

          userPrompt += `
          ${prompt?.aiIntro ? prompt.aiIntro : ''}
          ${prompt?.aiInstruction ? `Instructions : ${prompt.aiInstruction}` : ''}
          ${providedData ? `Collected data of user is ${providedData}. If the user has already provided their these details , you should not ask for them again. Keep these details and use wherever it needs.` : ''}`

          // let systemPrompt = `Today is: ${get_today()}.
          // Your name is Pooja, a Virtual Assistant to provide information for Kidney Care Centre and to book appointment for Home Dialysis Service.
          // Engage with user professionally to guide through the booking and cancellation of appointment process. Keep the responses short within 2-3 sentences.
          // To book appointment, ask for Patient name and Patient ID. Validate Patient Data and look up for available Slots within the same City. Present available slots as calendar-style presentation for the available slots: 
          // 📅 2025/02/03 - 10:00 AM, 3:00 PM
          // 📅 2025/02/04 - 9:30 AM, 4:00 PM
          // 📅 2025/02/05 - 11:00 AM, 2:30 PM
          // . When user opts for a slot, you must confirm by showing Date, Time & Patient's Address & City.
          // To cancel appointment, ask for Patient name and Patient ID. Look for booked appointment. Seek confirmation from user before cancelling. 
          // They might be able to say 'Are there available sessions for tomorrow?`

          let systemPrompt = `Today is: ${get_today()}.
          ${userPrompt}`

          console.log(`System Prompt:: ${systemPrompt}`)

          let extractedValues = {}

          const agent = new OpenAIAgent({
            tools: [retrieveKidneyCareToolWrapper(loadedQueryEngine), findBookedAppointment(), LookupPatientInfo(), BookAppointmentSlot(), CancelKidneyCareAppointment()],
            llm: llm,
            systemPrompt: `${systemPrompt}
            Use only available tools to answer. Provide concise response within knowledge base in maximum 200 words. And please don't modify the query, pass as it is query to the tool call.`,
            callbackManager: callbackManager,
            chatHistory: parsedContext
          })
          Settings.callbackManager.on("llm-tool-call", (event) => {
            // console.log('tool-call:: ', event.detail);
          });
          Settings.callbackManager.on("llm-tool-result", (event) => {
            console.log('tool-result:: ', event.detail);
            if (event.detail.toolCall.name == 'lookup_Patient_Information') {
              console.log('toolName:: ', event.detail.toolCall.name)
              const isCorrectJSON = isJsonString(event.detail?.toolResult?.input) ? event.detail?.toolResult?.input : false
              console.log('isCorrecttJSON:: ', isCorrectJSON, ", ", typeof (event.detail?.toolResult?.input))
              if (isCorrectJSON) {
                extractedValues = JSON.parse(event.detail?.toolResult?.input)
              } else {
                if (typeof (event.detail?.toolResult?.input) == 'object') {
                  extractedValues = event.detail?.toolResult?.input
                }
              }
            }
          });
          let rsp = await agent.chat({
            message: question
          })

          console.log('rsp:: ', rsp)

          const outputResponse = rsp.message.content


          if (Object.keys(extractedValues).length) {
            console.log('extractedValues:: ', JSON.stringify(extractedValues))
            output = {
              response: outputResponse,
              query: question,
              extractedValues: JSON.stringify(extractedValues),
              tokensConsumed: rsp?.raw?.usage?.total_tokens,
              error: false
            }
          } else {
            output = {
              response: outputResponse,
              query: question,
              tokensConsumed: rsp?.raw?.usage?.total_tokens,
              error: false
            }
          }
        default:
          break;
      }
      // console.log('aiModelSettingsObj:: ', aiModelSettingsObj)
    } else {
      output = {
        response: 'Feature is disabled.',
        query: question,
        tokensConsumed: 0,
        error: true
      }
    }
    console.log('output: ', JSON.stringify(output))
    const endTime = new Date();
    console.log(`query duration ${(endTime - startTime) / 1000} seconds`);
    return output
  } catch (error) {
    console.error('queryAIModel error:: ', error)
    return {
      response: 'Not trained properly.',
      tokensConsumed: 0,
      error: true
    }
  }
}