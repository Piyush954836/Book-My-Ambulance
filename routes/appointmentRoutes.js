const express = require("express");
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor"); // Import the Doctor model
const router = express.Router();

// In your backend code, before processing the request, log the request body
router.post('/book', async (req, res) => {
    console.log("Request Body:", req.body);  // Log the request body to inspect it
    try {
        const { doctorId, patientId, patientName, contact, age, date, time } = req.body;

        if (!doctorId || !patientId || !patientName || !contact || !age || !date || !time) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }

        const appointment = new Appointment({
            doctorId,
            patientId,  // Ensure patientId is included
            patientName,
            contact,
            age,
            date,
            time
        });

        await appointment.save();
        return res.status(200).json({ success: true, message: "Appointment booked successfully!" });
    } catch (error) {
        console.error("Error booking appointment:", error);
        return res.status(500).json({ success: false, message: "An error occurred while booking the appointment." });
    }
});

  

router.get("/appointments", async (req, res) => {
  try {
      const doctorId = req.session.doctorId; // Assuming doctor is logged in

      if (!doctorId) {
          return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const appointments = await Appointment.find({ doctorId });

      res.json(appointments);
  } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ success: false, message: "Failed to fetch appointments." });
  }
});

router.post("/update-appointment/:id", async (req, res) => {
  try {
      const { id } = req.params;
      const { status } = req.body;

      // Find appointment by ID and update status
      const updatedAppointment = await Appointment.findByIdAndUpdate(id, { status }, { new: true });

      if (!updatedAppointment) {
          return res.status(404).json({ success: false, message: "Appointment not found" });
      }

      res.json({ success: true, message: "Appointment status updated", appointment: updatedAppointment });
  } catch (error) {
      console.error("Error updating appointment status:", error);
      res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
