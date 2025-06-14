const { ChromaVectorStore}  = require("llamaindex");

const chromaVector = async (vectorDbDetails, embedModel) => {
    const vectorStore = await new ChromaVectorStore({
        collectionName: vectorDbDetails.collection,
        chromaClientParams: {
          path: vectorDbDetails.host,
          auth: {
            provider: "token",
            credentials:vectorDbDetails.token,
            tokenHeaderType: 'AUTHORIZATION'
          }
        },
        embeddingModel: embedModel
    });
    return vectorStore;
}

module.exports = { chromaVector }