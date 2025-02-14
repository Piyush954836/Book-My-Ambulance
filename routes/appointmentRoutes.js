const express = require("express");
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor"); // Import the Doctor model
const router = express.Router();

// In your backend code, before processing the request, log the request body

router.post('/book', async (req, res) => {
    const { doctorId, patientName, contact, age, date, time } = req.body;

    // Get patientId from the session
    const patientId = req.session.userId;  // Access userId from the session

    // Ensure patientId is a valid ObjectId
    const patientObjectId = new mongoose.Types.ObjectId(patientId);
 // Convert string to ObjectId

    // Check if all required fields are provided
    if (!doctorId || !patientId || !patientName || !contact || !age || !date || !time) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    try {
        const appointment = new Appointment({
            doctorId,
            patientId: patientObjectId,  // Use the converted patientId
            patientName,
            contact,
            age,
            date,
            time
        });

        // Save the appointment to the database
        await appointment.save();
        res.json({ success: true, message: "Appointment booked successfully!" });
    } catch (error) {
        console.error("Error booking appointment:", error);
        res.status(500).json({ success: false, message: "Failed to book appointment." });
    }
});

router.get("/appointments", async (req, res) => {
    try {
        const doctorId = req.session.doctorId;  // Assuming doctorId is stored in session

        // Check if doctor is logged in
        if (!doctorId) {
            return res.status(401).json({ success: false, message: "Doctor is not logged in." });
        }

        const appointments = await Appointment.find({ doctorId });

        // If no appointments are found, return an empty array or a message
        if (appointments.length === 0) {
            return res.status(200).json({ success: true, message: "No appointments found." });
        }

        res.json(appointments);
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({ success: false, message: "Failed to fetch appointments." });
    }
});

router.post("/update-appointment/:id", async (req, res) => {
    try {
        const { status } = req.body;
        const appointmentId = req.params.id;

        const updatedAppointment = await Appointment.findByIdAndUpdate(
            appointmentId,
            { status },
            { new: true } // Returns the updated document
        );

        if (!updatedAppointment) {
            return res.status(404).json({ success: false, message: "Appointment not found" });
        }

        res.json({ success: true, appointment: updatedAppointment });
    } catch (error) {
        console.error("Error updating appointment:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

router.get("/doctors/:doctorId/available-slots", async (req, res) => {
    const { doctorId } = req.params;
    const allSlots = ["10:00 AM", "11:30 AM", "2:00 PM", "3:45 PM"];

    try {
        const now = new Date();
        
        console.log("Fetching available slots for Doctor ID:", doctorId);

        // Find booked appointments within the last 24 hours
        const bookedAppointments = await Appointment.find({ 
            doctorId, 
            createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) }  // Last 24 hours
        });

        console.log("Booked Appointments:", bookedAppointments);

        // Extract booked slot times
        const bookedSlots = bookedAppointments.map(appointment => appointment.time);

        console.log("Booked Slots:", bookedSlots);

        // Get available slots
        const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));

        console.log("Available Slots:", availableSlots);

        res.json(availableSlots);
    } catch (error) {
        console.error("Error fetching slots:", error);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
