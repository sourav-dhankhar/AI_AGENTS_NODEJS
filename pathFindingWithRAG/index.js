import {
    ChromaVectorStore,
    VectorStoreIndex,
    OpenAIEmbedding,
    SentenceSplitter,
    CallbackManager,
    PromptHelper,
    OpenAI,
    Settings,
    getResponseSynthesizer,
    PromptTemplate,
} from "llamaindex";

import { configDotenv } from "dotenv";



configDotenv()

const collectionName = "XYZ_location_new"

const connections = [{
    "FromLocationID": "L001",
    "ToLocationID": "L003",
    "DirectionText": "From the Main Gate, walk straight for about 20 meters and you'll find the Help Desk slightly to the left.",
    "Mode": "Walk",
    "EstimatedTimeMin": 0.5,
    "Landmark": "Main Entrance",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L001",
    "ToLocationID": "L006",
    "DirectionText": "1. From the Main Gate, walk straight for about 20 meters and you'll find the Help Desk slightly to the left.\n2. Continue walking approximately 80 steps between the Help Desk counter and Reports collection counter to reach the Main Lift Lobby.",
    "Mode": "Walk",
    "EstimatedTimeMin": 1.5,
    "Landmark": "Information Counter",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(2)
},
{
    "FromLocationID": "L003",
    "ToLocationID": "L006",
    "DirectionText": "From the Help Desk, walk approximately 80 steps between the counters to reach the Main Lift Lobby.",
    "Mode": "Walk",
    "EstimatedTimeMin": 1.5,
    "Landmark": "Information Counter",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(2)
},
{
    "FromLocationID": "L004",
    "ToLocationID": "L006",
    "DirectionText": "From the Report Collection Counter, walk about 80 steps towards the left to reach the Main Lift Lobby.",
    "Mode": "Walk",
    "EstimatedTimeMin": 1.5,
    "Landmark": "Collections Area",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(2)
},
{
    "FromLocationID": "L011",
    "ToLocationID": "L006",
    "DirectionText": "Take the elevator from UG Floor back to the Ground Floor.",
    "Mode": "Lift",
    "EstimatedTimeMin": 0.45,
    "Landmark": "Floor Elevator",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L023",
    "ToLocationID": "L006",
    "DirectionText": "Take the elevator from Floor 2 back to the Ground Floor.",
    "Mode": "Lift",
    "EstimatedTimeMin": 0.61,
    "Landmark": "Floor Elevator",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L029",
    "ToLocationID": "L006",
    "DirectionText": "Take the elevator from Floor 3 back to the Ground Floor.",
    "Mode": "Lift",
    "EstimatedTimeMin": 0.69,
    "Landmark": "Floor Elevator",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L006",
    "ToLocationID": "L034",
    "DirectionText": "Take the elevator from the Main Lift Lobby to Floor 4.",
    "Mode": "Lift",
    "EstimatedTimeMin": 0.9,
    "Landmark": "Main Elevator",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L034",
    "ToLocationID": "L006",
    "DirectionText": "Take the elevator from Floor 4 back to the Ground Floor.",
    "Mode": "Lift",
    "EstimatedTimeMin": 0.77,
    "Landmark": "Floor Elevator",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L045",
    "ToLocationID": "L006",
    "DirectionText": "Take the elevator from Floor 5 back to the Ground Floor.",
    "Mode": "Lift",
    "EstimatedTimeMin": 0.85,
    "Landmark": "Floor Elevator",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L054",
    "ToLocationID": "L006",
    "DirectionText": "Take the elevator from Floor 6 back to the Ground Floor.",
    "Mode": "Lift",
    "EstimatedTimeMin": 0.93,
    "Landmark": "Floor Elevator",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L059",
    "ToLocationID": "L006",
    "DirectionText": "Take the elevator from Floor 7 back to the Ground Floor.",
    "Mode": "Lift",
    "EstimatedTimeMin": 1.01,
    "Landmark": "Floor Elevator",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L065",
    "ToLocationID": "L006",
    "DirectionText": "Take the elevator from Floor 8 back to the Ground Floor.",
    "Mode": "Lift",
    "EstimatedTimeMin": 1.09,
    "Landmark": "Floor Elevator",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L073",
    "ToLocationID": "L006",
    "DirectionText": "Take the elevator from Floor 9 back to the Ground Floor.",
    "Mode": "Lift",
    "EstimatedTimeMin": 1.17,
    "Landmark": "Floor Elevator",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L081",
    "ToLocationID": "L006",
    "DirectionText": "Take the elevator from Floor 10 back to the Ground Floor.",
    "Mode": "Lift",
    "EstimatedTimeMin": 1.25,
    "Landmark": "Floor Elevator",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L086",
    "ToLocationID": "L006",
    "DirectionText": "Take the elevator from Floor 11 back to the Ground Floor.",
    "Mode": "Lift",
    "EstimatedTimeMin": 1.33,
    "Landmark": "Floor Elevator",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L091",
    "ToLocationID": "L006",
    "DirectionText": "Take the elevator from Floor 12 back to the Ground Floor.",
    "Mode": "Lift",
    "EstimatedTimeMin": 1.41,
    "Landmark": "Floor Elevator",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L096",
    "ToLocationID": "L006",
    "DirectionText": "Take the elevator from Floor 14 back to the Ground Floor.",
    "Mode": "Lift",
    "EstimatedTimeMin": 1.57,
    "Landmark": "Floor Elevator",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
},
{
    "FromLocationID": "L034",
    "ToLocationID": "L039",
    "DirectionText": "Exit the elevator on Floor 4, turn right past the Billing Counter, continue past the Waiting Area and follow signs for Chest Surgery. Total distance is about 40 meters.",
    "Mode": "Walk",
    "EstimatedTimeMin": 0.83,
    "Landmark": "Chest Surgery Wing",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(3)
},
{
    "FromLocationID": "L038",
    "ToLocationID": "L039",
    "DirectionText": "From CTVS, follow the corridor for about 15 meters to reach Chest Surgery.",
    "Mode": "Walk",
    "EstimatedTimeMin": 0.38,
    "Landmark": "Floor 4 Department Signs",
    "ValidFrom": "1/1/2025",
    "ValidTo": "12/31/2030",
    "Accessibility": "Yes",
    "ComplexityScore": Number(1)
}]

const exceptions = [
    {
        AffectedConnection: 'L1_LOC → OPD002',
        Message: 'Lift A under maintenance',
        ValidFrom: '2025-04-01',
        ValidTo: '2025-04-03',
        AlternativeRoute: 'Use Lift B from Reception'
    },
    {
        AffectedConnection: 'Emergency_LOC → OPD002',
        Message: 'Path temporarily closed for sanitation',
        ValidFrom: '2025-04-07',
        ValidTo: '2025-04-08',
        AlternativeRoute: 'Follow detour signs to alternate lift'
    },
    {
        AffectedConnection: 'Parking_LOC → OPD003',
        Message: 'Path temporarily closed for sanitation',
        ValidFrom: '2025-04-07',
        ValidTo: '2025-04-08',
        AlternativeRoute: 'Follow detour signs to alternate lift'
    },
    {
        AffectedConnection: 'Staircase_LOC → OPD006',
        Message: 'Path temporarily closed for sanitation',
        ValidFrom: '2025-04-07',
        ValidTo: '2025-04-08',
        AlternativeRoute: 'Follow detour signs to alternate lift'
    }
];

const userProfile = [{
    ProfileType: 'Wheelchair',
    AllowedModes: ['Walk', 'Lift'],
    Description: 'Avoid stairs'
}];

const pointsOfInterest = [
    { POIID: 'P001', Name: 'Cafeteria', Type: 'Cafe', LocationId: 'E1_LOC', Description: 'Next to Main Lobby Entrance' }
];

const currentDate = '5/14/2025';

function createNewTextQaPrompt(customPrompt) {
    return `
    ${customPrompt}

      Context information is below.
      ---------------------
      {context}
      ---------------------
      Given the context information and not prior knowledge, answer the query within 200 words, ensuring that sentences are not left unfinished.
      Query: {query}
      Answer:`;
}


function buildGraph(connections, currentDate) {
    const graph = new Map();
    const currentDateObj = new Date(currentDate);

    for (const conn of connections) {
        const { FromLocationID, ToLocationID, Mode, EstimatedTimeMin, Landmark, DirectionText, ValidFrom, ValidTo, Accessibility } = conn;
        let isClosed = false;

        // for (const exc of exceptions) {
        //     if (exc.FROM === FromLocationID && exc.TO === ToLocationID) {
        //         const validFrom = new Date(exc.VALIDFROM);
        //         const validTo = new Date(exc.VALIDTO);
        //         if (currentDateObj >= validFrom && currentDateObj <= validTo) {
        //             isClosed = true;
        //             break;
        //         }
        //     }
        // }

        if (!isClosed) {
            console.log('graph vertex:: ', FromLocationID)
            if (!graph.has(FromLocationID)) graph.set(FromLocationID, []);
            graph.get(FromLocationID).push({ ToLocationID, Mode, EstimatedTimeMin, Landmark, DirectionText, ValidFrom, ValidTo, Accessibility });
        }
    }
    return graph;
}

// Find the shortest path using BFS
function findPath(graph, start, end, matchedProfile) {
    if (!graph.has(start) && !graph.has(end)) {
        console.log('graph findpath:: ', graph.has(start), ', ', start, ', ', end, ', ', graph.has(end));

        return { path: null, instructions: 'Neither start nor end point found in the graph.', totalTime: 0 };
    }


    const allowedModes = matchedProfile?.AllowedModes ? matchedProfile.AllowedModes : ['Walk', 'Lift'];
    const allPaths = [];


    function dfs(loc, path, totalTime, instructions, visited) {
        if (loc === end) {
            allPaths.push({
                path: [...path],
                instructions: [...instructions],
                totalTime
            });
            return;
        }

        const neighbors = graph.get(loc) || [];
        for (const { ToLocationID, Mode, EstimatedTimeMin, Landmark, DirectionText, ValidFrom, ValidTo, Accessibility } of neighbors) {
            if (visited.has(ToLocationID) || !allowedModes.includes(Mode) || Accessibility?.toLowerCase() != 'yes') {
                console.log("condition failed:: ", visited.has(ToLocationID), ", ", !allowedModes.includes(Mode), " ,", Accessibility)
                continue;
            }

            const currentDateObj = new Date(currentDate)
            const validFromDateObj = new Date(ValidFrom)
            const validToDateObj = new Date(ValidTo)

            if (!(currentDateObj >= validFromDateObj && currentDateObj <= validToDateObj)) {
                console.log('out of the valid date')
                continue
            }

            const newPath = [...path, ToLocationID];
            let newInstructions = [...instructions, `${DirectionText}. Near landmark is ${Landmark}`];
            const newTime = totalTime + EstimatedTimeMin;

            // Enhance instructions with nearby POIs
            // for (const poi of pointsOfInterest) {
            //     if (poi.location === loc || poi.location === ToLocationID) {
            //         newInstructions[newInstructions.length - 1] += ` (near ${poi.name})`;
            //     }
            // }

            visited.add(ToLocationID);
            dfs(ToLocationID, newPath, newTime, newInstructions, new Set(visited));
        }
    }

    dfs(start, [start], 0, [`Start at ${start}`], new Set([start]));

    // console.log('allpaths:: ', allPaths)

    return allPaths.length > 0
        ? allPaths
        : [{ path: null, instructions: ['No path found.'], totalTime: 0 }];
}

function findSuitablePath(start, end, matchedProfile) {
    const graph = buildGraph(connections, currentDate);
    console.log('graph:: ', graph.has('L001'))
    const result = findPath(graph, start, end, matchedProfile);
    return result;
}

async function main() {
    let sourcePointId;
    let destinationPointId;
    try {
        const llm = new OpenAI({
            azure: {
                apiKey: process.env.API_KEY,
                endpoint: process.env.END_POINT
            },
            model: "gpt-4",
            temperature: 0
        })

        const example = {
            sourcePoint: "L001",
            destinationPoint: "L008",
            userType: 'Wheelchair'
        };

        const response = await llm.complete({
            'prompt': `"You are a coordinate, userType finder. Extract source point and destination point and userType from a query which refers source point, destination and type of a person. If user type not found label it as 'Normal' \n\nGenerate a valid JSON in the following format:\n\n${JSON.stringify(
                example
            )}"

                <Query>
                I want to go from main gate to help desk.

                <Response>
                `})


        // console.log(response.text);

        const { sourcePoint, destinationPoint, userType } = JSON.parse(response.text)

        const promptHelper = new PromptHelper()

        const callbackManager = new CallbackManager()

        const nodeParser = new SentenceSplitter({})

        const embedModel = new OpenAIEmbedding({
            azure: {
                apiKey: process.env.API_KEY,
                endpoint: process.env.END_POINT
            },
            model: 'text-embedding-ada-002',
        });

        Settings.llm = llm
        Settings.embedModel = embedModel
        Settings.promptHelper = promptHelper
        Settings.callbackManager = callbackManager
        Settings.nodeParser = nodeParser

        const chromaVS = new ChromaVectorStore({ collectionName });

        const newTextQaPrompt = await createNewTextQaPrompt(`
        Instruction: Extract only location Ids like 'L001', 'L002', 'L034'
        `);

        const completePrompt = new PromptTemplate({
            templateVars: [
                "context",
                "query"
            ],
            template: newTextQaPrompt
        });

        const responseSynthesizer = getResponseSynthesizer('multi_modal', { textQATemplate: completePrompt })

        console.time("Index");
        const index = await VectorStoreIndex.fromVectorStore(chromaVS);
        console.timeEnd("index");

        const loadedQueryEngine = await index.asQueryEngine({ responseSynthesizer, similarityTopK: 5 })

        const sourcePointIdRes = await loadedQueryEngine.query({ query: `Location ID of ${sourcePoint}` });
        const destinationPointIdRes = await loadedQueryEngine.query({ query: `Location ID of ${destinationPoint}` })

        sourcePointId = sourcePointIdRes.message.content
        destinationPointId = destinationPointIdRes.message.content

        console.log('sourcePointId:: ', sourcePointId, ", destinationPointId:: ", destinationPointId)
        console.log(response.text);

        const matchedProfile = userProfile.find(profile => profile.ProfileType === userType);
        const allPaths = findSuitablePath(sourcePointId, destinationPointId, matchedProfile);
        console.log('allPaths:: ', allPaths)

        const directionMessage = await llm.complete({
            'prompt': `"You are a guide at XYZ hospital. 
            You are given :
            - User condition.  
            - Point of Interest to enhance user instructions if needed.
            - Exceptions to route user with given AlternativeRoute if any blocked route comes under the route.
            - All routes with instructions and time in minutes.
            - Use Landmarks wisely to make path clear, only including them when they provide distinct, non-redundant guidance (e.g., a nearby feature that helps locate the target).
            - **Strictly prohibit including a landmark in an instruction if it refers to the same location, object, or feature as the instruction itself (e.g., do not use "Main Elevator" as a landmark for an instruction about taking the elevator in the Main Lift Lobby). If the source route instructions include such a landmark, remove it from the response.**
            - When generating instructions, prioritize clarity and brevity, ensuring each step is concise and landmarks are only included when they aid navigation.
            Guide a new person to reach ${destinationPoint} from ${sourcePoint}"

            <CONDITION>
                - User is marked as a ${userType} user in UserProfiles
                - ${matchedProfile?.Description ? matchedProfile.Description : ''}
            <POINT_OF_INTEREST>
            ${JSON.stringify(pointsOfInterest)}
            <EXCEPTIONS>
            ${JSON.stringify(exceptions)}
            <ALL_ROUTES>
            ${JSON.stringify(allPaths)}

            <Response>
            `})

        console.log('complete prompt:: ', `"You are a guide at XYZ hospital. 
        You are given :
        - User condition.  
        - Point of Interest to enhance user instructions if needed.
        - Exceptions to route user with given AlternativeRoute if any blocked route comes under the route.
        - All routes with instructions and time in minutes.
        - Use Landmarks wisely to make path clear , if not required then don't include.
        
        Guide a new person to reach ${destinationPoint} from ${sourcePoint}"

        <CONDITION>
            - User is marked as a ${userType} user in UserProfiles
            - ${matchedProfile?.Description ? matchedProfile.Description : ''}
        <POINT_OF_INTEREST>
        ${JSON.stringify(pointsOfInterest)}
        <EXCEPTIONS>
        ${JSON.stringify(exceptions)}
        <ALL_ROUTES>
        ${JSON.stringify(allPaths)}

        <Response>
        `)
        console.log('directionMessage:: ', directionMessage.text)


        
    } catch (e) {
        console.error(e);
    }

    // const startPoint = 'L001';
    // const endPoint = 'L039';

}

void main();
