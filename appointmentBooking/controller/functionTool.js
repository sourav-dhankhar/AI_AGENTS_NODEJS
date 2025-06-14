const { postOnWebhook } = require('./webhook')

require('dotenv').config()
const { FunctionTool, QueryEngineTool } = require("llamaindex");

const { fetchPatientInfo, fetchPatientSlots, updateKidneyCareSlot, findKidneyCareAppointment, cancelKidneyCareAppointment, bookedKidneyCareAppointments, fetchKidneyCareSlotByDate } = require('../utils/dbConnect')
const { parseDate } = require('../utils/helper')

const postInfoToolWrapper = (collect, webHookDetails) => {
  const keys = Object.keys(collect)
  const extractingValues = keys.length ? keys : [...keys, 'name']
  const webHookDetailsInternal = webHookDetails
  const dynamicProperties = extractingValues.reduce((acc, key) => {
    acc[key] = {
      type: "string",  // Assuming all fields are of type "string", you can adjust this as necessary
      description: collect[key],  // A basic dynamic description
    };
    return acc;
  }, {});

  console.log('dynamicProperties:: ', dynamicProperties)

  const postInfo = FunctionTool.from(
    async ({ name, phone, email }) => {
      const payload = extractingValues.reduce((acc, key) => {
        if (key == 'name') {
          acc[key] = name
        } else if (key == 'phone') {
          acc[key] = phone
        } else if (key == 'email') {
          acc[key] = email
        }
        return acc;
      }, {});

      try {
        console.log('payload:: ', payload, " type of payload:: ", typeof payload, ", ", webHookDetailsInternal)
        // Send a POST request to the webhook URL
        if (webHookDetailsInternal && Object.keys(payload).length) {
          await postOnWebhook({ data: payload, webHookDetails: webHookDetailsInternal })
        }
      } catch (error) {
        console.error('Error posting data:', error);
      }
      return JSON.stringify(payload);
    },
    {
      name: "postUserInfo",
      description: `Use this function to post this info ${extractingValues} on webhook`,
      parameters: {
        type: "object",
        properties: dynamicProperties,
        required: extractingValues,
      },
    },
  )
  return postInfo
}

const retrieverToolWrapper = (loadedQueryEngine) => {
  const queryEngineTool = new QueryEngineTool({
    queryEngine: loadedQueryEngine,
    metadata: {
      name: "query_engine",
      description: "A query engine for the documents.",
    },
  });

  return queryEngineTool
}

const retrieveKidneyCareToolWrapper = (loadedQueryEngine) => {
  const queryEngineTool = new QueryEngineTool({
    queryEngine: loadedQueryEngine,
    metadata: {
      name: "kidney_care_tool",
      description: "This tool can answer detailed questions about the comprehensive kidney care services overview.",
    },
  });

  return queryEngineTool
}

// Kidney Care booking Start
const LookupPatientInfo = () => {
  const lookPatientInfo = FunctionTool.from(
    async ({ name, patient_id }) => {
      console.log('Lookup patient info ', name, ", ", patient_id)
      try {
        const patientInfo = await fetchPatientInfo(name, patient_id);
        console.log('patientInfo:: ', patientInfo);
        if (patientInfo) {
          const slotsDocs = await fetchPatientSlots(patientInfo)
          console.log('slotDocs:: ', slotsDocs)
          if (slotsDocs.length) {
            // Filter available slots (where name is null)
            let availableSlots = []
            for (let doc of slotsDocs) {
              let availableSlot = doc.appointments.filter(appointment => appointment.name === null).map(appointment => {
                return {
                  "date": doc.date,
                  "time": appointment.time
                }
              })
              availableSlots = [...availableSlots, ...availableSlot]
            }

            console.log('available slots:: ', availableSlots)

            return {
              available_slots: JSON.stringify(availableSlots) + `. Show these slots in calendar-style presentation, like this for example 📅 2025/02/03 - 10:00 AM, 3:00 PM
            📅 2025/02/04 - Jan 30 - 9:30 AM, 4:00 PM
            📅 2025/02/05 - Jan 31 - 11:00 AM, 2:30 PM
            `,
            user_location_city: patientInfo.address + patientInfo.city + `. Show this info with location icon to user, like this for example 📍 Location: 123 Green Street, Mumbai`
          };
          } else {
            return { message: "No available slots for your city" };
          }
        } else {
          return { message: "No patient found with these details" };
        }
      } catch (error) {
        console.error('LookupPatientInfo error:: ', error)
        return error
      }
    },
    {
      name: "lookup_Patient_Information",
      description: `Look up for Patient Information to give available slots in their city in the calendar-style presentation , like this
      📅 2025/02/03 - 10:00 AM, 3:00 PM
      📅 2025/02/04 - 9:30 AM, 4:00 PM

      with user location in this format 📍 Location: 123 Green Street, Mumbai
      .`,
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the patient to view available slots in their city",
          },
          patient_id: {
            type: "string",
            description: "The Patient ID of the Patient to view available slots in their city",
          }
        },
        required: ["name", "patient_id"],
      },
    },
  )
  return lookPatientInfo
}

const findBookedAppointment = () => {
  const postInfo = FunctionTool.from(
    async ({ name, patient_id }) => {
      console.log('find booked appointment:: ', name, ", ", patient_id)
      try {
        const patientInfo = await fetchPatientInfo(name, patient_id);
        console.log('patientInfo:: ', patientInfo);
        if (patientInfo) {
          const appointmentsDoc = await bookedKidneyCareAppointments(name, patient_id)
          if (appointmentsDoc.length) {
            let bookedSlots = []
            for (let doc of appointmentsDoc) {
              let bookedSlot = doc.appointments.filter(appointment => (appointment?.name?.toLowerCase() == name.toLowerCase() && appointment.patient_id == patient_id)).map(appointment => {
                return {
                  "date": doc.date,
                  "time": appointment.time
                }
              })
              bookedSlots = [...bookedSlots, ...bookedSlot]
            }
            console.log('booked slots:: ', bookedSlots)

            return {
              bookedSlots: JSON.stringify(bookedSlots) + `. Show these slots in calendar-style presentation, like this for example 📅 2025/02/03 - 10:00 AM, 3:00 PM
            📅 2025/02/04 - Jan 30 - 9:30 AM, 4:00 PM
            `};
          } else {
            return { message: "No Appointment found." };
          }
        } else {
          return { message: "No patient found." };
        }
      } catch (error) {
        return error
      }
    },
    {
      name: "find_booked_appointment",
      description: `Find booked appointments for a particular patient name and patient id.`,
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Full name of the patient who has scheduled appointments.",
          },
          patient_id: {
            type: "string",
            description: "Unique identifier (Patient ID) for the patient with booked appointments.",
          }

        },
        required: ["name", "patient_id"],
      },
    },
  )
  return postInfo
}

const BookAppointmentSlot = () => {
  const bookAppointmentSlot = FunctionTool.from(
    async ({ date, time, name, patient_id, address }) => {
      console.log('bookAppointmentSlot date, time, name, patient_id, address:: ', date, ", ", time, ", ", name, ", ", patient_id, ", ", address)
      try {
        const patientInfo = await fetchPatientInfo(name, patient_id);
        console.log('patientInfo:: ', patientInfo);
        if (patientInfo) {
          const parsedDate = parseDate(date)
          const slots = await fetchKidneyCareSlotByDate(parsedDate);
          if (!slots) {
            // If the schedule doesn't exist for the given date, return an error
            return { message: "No slots found for the given date" };
          }

          // Find the appointment with the specified time
          const appointment = slots.appointments.find(app => app.time === time);

          if (!appointment) {
            // If the time slot doesn't exist, return an error
            return { message: `Slot for ${time} is not avaialable.` };
          }

          if (appointment.name !== null) {
            // If the slot is already booked, return an error
            return { message: `Sorry, the slot at ${time} on ${parsedDate} is already booked!` };
          }

          console.log('appointment:: ', appointment)

          const updatedSlot = await updateKidneyCareSlot(parsedDate, time, { name, phone: patientInfo.phone, patient_id, address: `${patientInfo.address} ${patientInfo.city}` })
          if (updatedSlot) {
            return {
              message: `Appointment booked for ${name} ${patient_id} (${patientInfo.phone}) at ${time} on ${parsedDate} for location ${patientInfo.address} ${patientInfo.city}. Instructions: And present this information like this, 📅 Date: Monday, Jan 29
          ⏰ Time: 10:00 AM
          📍 Your Location: ${patientInfo.address} ${patientInfo.city}.
          Further ask if the patient needs nurse assistance and if he needs to know how to prepare for dialysis session.
          `};
          } else {
            return { message: `An error occurred while booking the appointment.` };
          }
        } else {
          return { message: "No patient found with these details" };
        }
      } catch (error) {
        console.error('Book Appointment slot error:: ', error)
        return error
      }
    },
    {
      name: "book_Appointment_Slot",
      description: `Book slot in the specified city and on specific date and time. And present information like this, 📅 Date: Monday, Jan 29
      ⏰ Time: 10:00 AM 
      📍 Your Location: 123 Green Street, Mumbai`,
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "The date to book the slot (YYYY-MM-DD, 'today', 'tomorrow')",
          },
          time: {
            type: "string",
            description: "The time to book the slot (HH:MM)",
          },
          name: {
            type: "string",
            description: "The name of the patient booking the slot",
          },
          patient_id: {
            type: "string",
            description: "The Patient ID of the Patient booking the slot",
          },
          address: {
            type: "string",
            description: "Address of the Patient booking the slot",
          }
        },
        required: ["date", "time", "name", "patient_id", "address"],
      },
    }
  )
  return bookAppointmentSlot
}

const selectAppointmentSlot = () => {
  const selectAppointmentSlot = FunctionTool.from(
    async ({ date, time, name, patient_id }) => {
      console.log('selectAppointmentSlot date, time, name, patient_id:: ', date, ", ", time, ", ", name, ", ", patient_id)
      try {
        const patientInfo = await fetchPatientInfo(name, patient_id);
        console.log('patientInfo:: ', patientInfo);
        if (patientInfo) {
          const parsedDate = parseDate(date)
          const slots = await fetchKidneyCareSlotByDate(parsedDate);
          if (!slots) {
            // If the schedule doesn't exist for the given date, return an error
            return { message: "No slots found for the given date" };
          }

          // Find the appointment with the specified time
          const appointment = slots.appointments.find(app => app.time === time);

          if (!appointment) {
            // If the time slot doesn't exist, return an error
            return { message: `Slot for ${time} is not avaialable.` };
          }

          if (appointment.name !== null) {
            // If the slot is already booked, return an error
            return { message: `Sorry, the slot at ${time} on ${parsedDate} is already booked!` };
          }

          console.log('patientInfo.address:: ', patientInfo.address)
          return {
            message: `Ask patient to confirm address 📍${patientInfo.address} for appointment booking.`
          };
        } else {
          return { message: "No patient found with these details" };
        }
      } catch (error) {
        console.error('Book Appointment slot error:: ', error)
        return error
      }
    },
    {
      name: "select_Appointment_Slot",
      description: `Select slot in the specified city and on specific date and time. Ask patient to confirm their address and present it in this way -> 📍 123 Green Street, Mumbai, Maharashtra, 400001.`,
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "The date to book the slot (YYYY-MM-DD, 'today', 'tomorrow')",
          },
          time: {
            type: "string",
            description: "The time to book the slot (HH:MM)",
          },
          name: {
            type: "string",
            description: "The name of the patient booking the slot",
          },
          patient_id: {
            type: "string",
            description: "The Patient ID of the Patient booking the slot",
          }
        },
        required: ["date", "time", "name", "patient_id"],
      },
    }
  )
  return selectAppointmentSlot
}

const CancelKidneyCareAppointment = () => {
  const cancelKidneyCareApp = FunctionTool.from(
    async ({ name, patient_id, date, time }) => {
      console.log('cancel kidney care appointment :: ', name, ", ", patient_id, ", ", date, ", ", time)
      try {
        let appointment = await findKidneyCareAppointment(name, patient_id, date, time)
        if (!appointment) {
          return { message: `No matching appointment found.` };
        }
        let appointmentCancelled = false;
        let isAppointmentCancelled = false;
        for (let app of appointment.appointments) {
          if (app?.name?.toLowerCase() === name.toLowerCase() && app.patient_id === patient_id && app.time === time) {
            app.name = null
            app.phone = null
            app.patient_id = null
            app.address = null
            appointmentCancelled = true;
          }

          // Update the document in the collection after modifying the appointments
          if (appointmentCancelled) {
            isAppointmentCancelled = await cancelKidneyCareAppointment(appointment)
            break;  // Stop the loop if the appointment is cancelled
          }
        }
        console.log('isAppointmentCancelled:: ', isAppointmentCancelled)
        if (isAppointmentCancelled) {
          return { message: `Appointment for ${name} (${patient_id}) has been cancelled.` };
        } else {
          return { message: `No matching appointment found.` };
        }
      } catch (error) {
        console.error('Cancel kidney care appointment error:: ', error)
        return error
      }
    },
    {
      name: "cancel_Appointment",
      description: `Cancel an existing appointment for specific Patient and Time Slot`,
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the patient cancelling the appointment",
          },
          patient_id: {
            type: "string",
            description: "The Patient ID of the Patient cancelling the appointment",
          },
          date: {
            type: "string",
            description: "The date of Booked Appointment (YYYY-MM-DD) to cancel",
          },
          time: {
            type: "string",
            description: "The date of Booked Appointment (HH:MM) to cancel",
          },
        },
        required: ["name", "patient_id", "date", "time"],
      },
    },
  )
  return cancelKidneyCareApp
}

// Kidney Care booking End

module.exports = { postInfoToolWrapper, retrieverToolWrapper, retrieveKidneyCareToolWrapper, LookupPatientInfo, BookAppointmentSlot, CancelKidneyCareAppointment, findBookedAppointment, selectAppointmentSlot };