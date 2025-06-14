require('dotenv').config()
const { chromaVector } = require('./chromaDB')
const { VectorStoreIndex, OpenAIEmbedding, OpenAI, PromptHelper, CallbackManager, OpenAIAgent, Settings, Groq, HuggingFaceInferenceAPIEmbedding, HuggingFaceInferenceAPI, ContextChatEngine, SentenceSplitter, getResponseSynthesizer, PromptTemplate } = require("llamaindex");

const LLM_TEMP = process.env.LLM_TEMPERATURE
const GROQ_ENDPOINT = process.env.GROQ_ENDPOINT
const HUGGINGFACE_ENDPOINT = process.env.HUGGINGFACE_ENDPOINT
const MAX_TOKENS = 500
const SIMILARITY_TOP_K = 3

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

function formatChatHistory(chatHistory) {
    let formattedHistory = '';

    // Iterate through the chat history and format each entry
    chatHistory.forEach(entry => {
        // Check the role of the entry and format accordingly
        if (entry.role === 'user') {
            formattedHistory += `User: ${entry.content}\n`;
        } else {
            formattedHistory += `System: ${entry.content}\n`;
        }
    });

    return formattedHistory.trim(); // Ensure there are no trailing newlines
}

function identifyQueryLanguage(question) {
    let prompt = `"Analyze the following user query and identify the language it is written in. Provide only the name of the language as the response. If the language cannot be recognized, respond with "Unknown".

  User query: ${question}`

    console.log('identifyQueryLanguagePrompt:: ', prompt)

    return prompt
}

function queryContextTemplate(chatHistory, question) {

    const example = {
        "rephrased_question": "Rephrased question of user.",
        "language": "Language of original question of user."
    }

    let prompt = `"Given a chat history and the latest user question, which may refer to context in the chat history, only rephrase the question so that it can be fully understood without requiring any reference to the chat history. Do not introduce any new specifics or details that are not part of the original question. Do not provide any answers to the question. Just reword it if needed based on the chat history. If the question doesn’t need rewording, simply return it as it is, even if it's a greeting. 
  - **Ensure that the rephrased question is in the exact same language as the latest user query, regardless of chat history language.**
  - **Chat history should only be used for reference but should never override the language of the latest user Question.**
  - Generate a valid JSON in the following format:\n\n${JSON.stringify(
        example
    )}"
  <Chat History>
  ${chatHistory}
  <Question>
  ${question}
  <Standalone question>`

    console.log('queryContextPrompt:: ', prompt)

    return prompt
}

function createNewTextQaPrompt(customPrompt, chatHistory) {
    // let chatHistoryObj = JSON.parse(chatHistory)
    // const improvisedChatHistory = formatChatHistory(chatHistoryObj)
    return `
  Context information is below.
  ---------------------
  {context}
  ---------------------
  Given the context information and not prior knowledge, answer the query under 150 words.
  Query: {query}
  Answer:`;
}

function createNewTextRefinePrompt() {
    return `The original query is as follows: {query}
  We have provided an existing answer: {existingAnswer}
  We have the opportunity to refine the existing answer
  (only if needed) with some more context below.
  ------------
  {context}
  ------------
  Given the new context, refine the original answer to better answer the query (only if needed).
  If the context isn't useful, return the original answer.
  Refined Answer:`
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
// It is multilingual , chat RAG system
// question: Question which user ask
// context: chat history with user and assistant label keep last 4-6 chat histories
// prompt: PERSONA + INSTRUCTIONS
// aiModelSettings: it is an object which have llm type, embed type, vectordatabase type, then find its credentials
async function queryAIModel(question, context, prompt, providedData, aiModelSettings) {
    console.log('queryAIModel:: ')
    const aiModelSettingsObj = isJsonString(aiModelSettings) ? JSON.parse(aiModelSettings) : false
    let output
    try {
        const startTime = new Date();
        if (aiModelSettingsObj) {
            // console.log('aiModelSettingsObj:: ', aiModelSettingsObj)
            switch (aiModelSettingsObj.vector_db.type) {
                case "chromadb":
                    console.log("------ Time Calculation starts here ------")

                    console.time('LLM');
                    const llm = await getLLM(aiModelSettingsObj)
                    console.timeEnd('LLM');
                    const promptHelper = new PromptHelper()

                    const callbackManager = new CallbackManager()

                    const nodeParser = new SentenceSplitter({
                        chunkSize: 512,
                        chunkOverlap: 150
                    })

                    console.time('GET_EMBEDDINGS');
                    const embedModel = await getEmbeddings(aiModelSettingsObj)
                    console.timeEnd('GET_EMBEDDINGS');

                    console.time('VECTOR_STORE');
                    const vectorStore = await chromaVector(aiModelSettingsObj.vector_db, embedModel);
                    console.timeEnd('VECTOR_STORE');
                    console.time('LOADED_INDEX');

                    Settings.llm = llm
                    Settings.embedModel = embedModel
                    Settings.promptHelper = promptHelper
                    Settings.callbackManager = callbackManager
                    Settings.nodeParser = nodeParser

                    const loadedIndex = await VectorStoreIndex.fromVectorStore(vectorStore, {
                        llm: llm,
                        promptHelper: promptHelper,
                        embedModel: embedModel,
                        nodeParser: nodeParser,
                        callbackManager: callbackManager,
                    });
                    console.timeEnd('LOADED_INDEX');
                    const example = JSON.parse(prompt.collect);
                    delete example['response']
                    let userPrompt = '';

                    userPrompt += `
          ${prompt?.aiIntro ? prompt.aiIntro : ''}
          ${prompt?.aiInstruction ? `Instructions : ${prompt.aiInstruction}` : ''}
          ${providedData ? `Collected data of user is ${providedData}. If the user has already provided their details , you should not ask for them again. Instead, proceed to address their query.` : ''}`

                    console.time('QUERY_ENGINE');

                    const newTextQaPrompt = createNewTextQaPrompt(userPrompt, context);

                    const newTextRefinePrompt = createNewTextRefinePrompt();

                    const newTextRefineTemplate = new PromptTemplate({
                        templateVars: [
                            "query",
                            "existingAnswer",
                            "context"
                        ],
                        template: newTextRefinePrompt
                    })

                    const newTextQATemplate = new PromptTemplate({
                        templateVars: [
                            "context",
                            "query"
                        ],
                        template: newTextQaPrompt
                    });

                    // Create the ResponseSynthesizer with the generated newTextQaPrompt
                    const responseSynthesizer = getResponseSynthesizer('multi_modal', { textQATemplate: newTextQATemplate, refineTemplate: newTextRefineTemplate })

                    const loadedQueryEngine = loadedIndex.asQueryEngine({ responseSynthesizer, similarityTopK: SIMILARITY_TOP_K });
                    const retriever = loadedQueryEngine.retriever;
                    const parsedContext = JSON.parse(context)
                    const lastTwoMessages = parsedContext.length ? parsedContext.slice(-2) : parsedContext
                    const llm_temp0 = await getLLM(aiModelSettingsObj, true)
                    const rephrasedContext = parsedContext.length ? await llm_temp0.complete(
                        {
                            prompt: queryContextTemplate(JSON.stringify(lastTwoMessages), question)
                        }
                    ) : await llm_temp0.complete(
                        {
                            prompt: identifyQueryLanguage(question)
                        }
                    )
                    console.timeEnd('QUERY_ENGINE');

                    let queryContext = null

                    if (parsedContext.length) {
                        if (isJsonString(rephrasedContext.text)) {
                            console.log("Valid JSON:: ", rephrasedContext.text);
                            queryContext = JSON.parse(rephrasedContext.text);
                            console.log('Quer Language:: ', queryContext.language)
                            if (queryContext.language == 'Unknown' || !queryContext.language) {
                                queryContext.language = 'English'
                            }
                        } else {
                            console.log("Invalid JSON:: ", rephrasedContext.text);
                            queryContext = {
                                rephrased_question: question,
                                language: 'English'
                            }
                        }
                    } else {
                        console.log("Not parsedContextLength lanaguage:: ", rephrasedContext.text);
                        queryContext = {
                            rephrased_question: question,
                            language: rephrasedContext.text != 'Unknown' ? rephrasedContext.text : 'English'
                        }
                    }


                    const chatEngine = new ContextChatEngine({ retriever, chatModel: llm, systemPrompt: `${userPrompt}\n\nThe user asked a question in ${queryContext.language} language. Respond to query within the given context under 150 words in ${queryContext.language} language, regardless of the language or clarity of the input**` });

                    console.log('Query is chosen:: ', queryContext.rephrased_question)

                    let myQuestion = queryContext.rephrased_question;

                    console.log('myQuestion:: ', myQuestion)

                    console.time('QUERY');
                    const finalAnswer = await chatEngine.chat({
                        message: myQuestion,
                        chatHistory: parsedContext,
                        verbose: true
                    });

                    // const existingAnswer = await loadedQueryEngine.query({
                    //   query: myQuestion
                    // });

                    // const finalAnswer = await llm_temp0.complete(
                    //   {
                    //     prompt: finaliseResponseTemplate(userPrompt, context, existingAnswer.message.content, queryContext.rephrased_question)
                    //   }
                    // )

                    console.timeEnd('QUERY');
                    console.log("------ Time Calculation ends here ------ \n")
                    let total_credits = finalAnswer.raw.usage.total_tokens
                    // total_credits += myQuestion.length
                    // total_credits += existingAnswer.message.content.length
                    console.log('final answer usage:: ', finalAnswer.raw.usage)
                    finalAnswer?.sourceNodes?.forEach(node => {
                        if (node?.node?.text?.length) {
                            // total_credits += node.node.text.length
                            console.log(`Node: ${node.node.text}, Score: ${node.score}\n\n`);
                        }
                    });

                    output = {
                        response: finalAnswer.message.content,
                        query: queryContext.rephrased_question,
                        tokensConsumed: total_credits,
                        error: false
                    }
                    break;
                default:
                    break;
            }
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