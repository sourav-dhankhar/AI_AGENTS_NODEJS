const { MongoClient, ObjectId } = require('mongodb');

require('dotenv').config({ path: '../.env' })

var mongoClient, db;

const connect = async function () {
    if (db) {
        return db;
    } else {
        let connectionOptions = {
            maxPoolSize: 50,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 30000,
            waitQueueTimeoutMS: 10000,
            maxIdleTimeMS: 60000
        }
        mongoClient = new MongoClient(process.env.BOT_DB_URI, connectionOptions);
        await mongoClient.connect();
        db = mongoClient.db(process.env.BOT_DB);
        return db;
    }
}

exports.fetchAIPlatoforms = async () => {
    try {
        console
        let db2 = await connect();
        let collection = await db2.collection(process.env.AI_PLATFORMS);
        const ai_platforms = await collection.find().toArray();
        return ai_platforms;
    } catch (error) {
        console.error('fetchAIPlatoforms error:: ', error)
        return false
    }
}

exports.fetchSlots = async (date) => {
    try {
        let db2 = await connect();
        let collection = await db2.collection(process.env.APPOINTMENT_DATA);
        const result = await collection.findOne({ date: date });
        return result;
    } catch (error) {
        console.error('fetchSlots error:: ', error)
        return false
    }
}

exports.updateSlot = async (date, time, appointmentDetails) => {
    try {
        let db2 = await connect();
        let collection = await db2.collection(process.env.APPOINTMENT_DATA);
        const result = await collection.updateOne({
            "date": date,
            "appointments.time": time
        },
            {
                $set: {
                    "appointments.$.name": appointmentDetails.name,
                    "appointments.$.phone": appointmentDetails.phone,
                    "appointments.$.patient_id": appointmentDetails.patient_id
                }
            })
        return true
    } catch (error) {
        console.error('fetchAIPlatoforms error:: ', error)
        return false
    }
}

exports.findAppointment = async (name, phone) => {
    try {
        let db2 = await connect();
        let collection = await db2.collection(process.env.APPOINTMENT_DATA);

        const schedule = await collection.find({ "appointments.name": name, "appointments.phone": phone }).toArray();
        return schedule
    } catch (error) {
        console.error('findAppointment error:: ', error)
        return false
    }
}

exports.cancelAppointment = async (appointmentDoc) => {
    try {
        let db2 = await connect();
        let collection = await db2.collection(process.env.APPOINTMENT_DATA);

        await collection.updateOne(
            { _id: appointmentDoc._id },  // Match the document by its unique ID
            { $set: { appointments: appointmentDoc.appointments } }  // Update the appointments array
        );

        return true

    } catch (error) {
        console.error('cancelAppointment error:: ', error)
        return false
    }
}

exports.fetchPatientInfo = async (name, patient_id) => {
    let query = { name: { $regex: new RegExp(name, 'i') }, patient_id: patient_id }
    try {
        let db2 = await connect();
        let collection = await db2.collection(process.env.KIDNEY_CARE_PATIENT);
        const result = await collection.findOne(query);
        console.log('fetchPatientInfo query:: ', query)
        return result;
    } catch (error) {
        console.error('fetchPatientInfo error:: ', error)
        return false
    }
}

exports.fetchPatientSlots = async (patientInfo) => {
    const todaysDate = new Date()
    const today = todaysDate.toLocaleDateString('en-CA');
    let query = { date: { $gte: today }, city: { $regex: new RegExp(patientInfo.city, 'i') } }
    try {
        let db2 = await connect();
        let collection = await db2.collection(process.env.KIDNEY_CARE_APPOINTMENT_SCHEDULING);

        const result = await collection.find(query).toArray();
        console.log('fetchPatientSlots query:: ', query)
        return result;
    } catch (error) {
        console.error('fetchPatientSlots error:: ', error)
        return false
    }
}


exports.fetchKidneyCareSlotByDate = async (date) => {
    let query = { date: date }
    try {
        let db2 = await connect();
        let collection = await db2.collection(process.env.KIDNEY_CARE_APPOINTMENT_SCHEDULING);
        const result = await collection.findOne(query);
        console.log('fetchKidneyCareSlotByDate query:: ', query)
        return result;
    } catch (error) {
        console.error('fetchKidneyCareSlotByDate error:: ', error)
        return false
    }
} 

exports.updateKidneyCareSlot = async (date, time, appointmentDetails) => {
    let query = {
        "date": date,
        "appointments.time": time
    }
    let updateObject = {
        "appointments.$.name": appointmentDetails.name,
        "appointments.$.phone": appointmentDetails.phone,
        "appointments.$.patient_id": appointmentDetails.patient_id,
        "appointments.$.address": appointmentDetails.address
    }
    try {
        let db2 = await connect();
        let collection = await db2.collection(process.env.KIDNEY_CARE_APPOINTMENT_SCHEDULING);
        console.log('updateKidneyCareSlot:: ', date, ", ", time, ", ", JSON.stringify(appointmentDetails))
        const result = await collection.updateOne(query,
            {
                $set: updateObject
            })
        console.log('updateKidneyCareSlot query:: ', query, ", ", updateObject)
        return true
    } catch (error) {
        console.error('updateKidneyCareSlot error:: ', error)
        return false
    }
}

exports.bookedKidneyCareAppointments = async (name, patient_id) => {
    let query = {
        "appointments.name": { $regex: new RegExp(name, 'i') },
        "appointments.patient_id": patient_id
    }
    try {
        let db2 = await connect();
        let collection = await db2.collection(process.env.KIDNEY_CARE_APPOINTMENT_SCHEDULING);

        const bookedAppointments = await collection.find(
            query,
            {
                "date": 1,
                "appointments.$": 1
            }
        ).toArray()
        console.log("bookedKidneyCareAppointments query:: ", query)
        return bookedAppointments
    } catch (error) {
        console.error('bookedKidneyCareAppointments error:: ', error)
        return false
    }
}

exports.findKidneyCareAppointment = async (name, patient_id, date, time) => {
    let query = { "appointments.name": { $regex: new RegExp(name, 'i') }, "appointments.patient_id": patient_id, "date": date, "appointments.time": time }
    try {
        let db2 = await connect();
        let collection = await db2.collection(process.env.KIDNEY_CARE_APPOINTMENT_SCHEDULING);

        const schedule = await collection.findOne(query);
        console.log("findKidneyCareAppointment query:: ", query)
        return schedule
    } catch (error) {
        console.error('findKidneyCareAppointment error:: ', error)
        return false
    }
}

exports.cancelKidneyCareAppointment = async (appointmentDoc) => {
    let filter = { _id: appointmentDoc._id };
    let updateObject = { appointments: appointmentDoc.appointments };
    try {
        let db2 = await connect();
        let collection = await db2.collection(process.env.KIDNEY_CARE_APPOINTMENT_SCHEDULING);

        const result = await collection.updateOne(
            filter,  // Match the document by its unique ID
            { $set: updateObject }  // Update the appointments array
        );

        console.log('cancelKidneyCareAppointment query:: ', filter, ", ", JSON.stringify(updateObject))

        return true

    } catch (error) {
        console.error('cancelKidneyCareAppointment error:: ', error)
        return false
    }
}