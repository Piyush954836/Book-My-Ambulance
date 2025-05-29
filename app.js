const express = require('express');
const http = require("http");
const app = express();
const path = require('path');
const userRoutes = require('./routes/userRoutes');
const driverRoutes = require('./routes/driverRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const hospitalRoutes = require("./routes/hospitalRoutes");
const locationRoutes = require('./routes/locationRoutes'); 
const bookingRoutes = require('./routes/bookingRoutes');
const Driver = require('./models/Driver');
const Doctor = require('./models/Doctor');
const User = require('./models/User');
const Appointment = require('./models/Appointment');
const Booking = require('./models/Booking');
const Hospital = require('./models/Hospital');
const session = require('express-session');
const socketIo = require("socket.io");
const flash = require('connect-flash');
const appointmentRoutes = require("./routes/appointmentRoutes");
const cron = require("node-cron");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
require('dotenv').config();

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// Main database connection
const { connectDB } = require('./utils/mainDB'); 
connectDB(); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set('view engine', 'ejs');

app.use(session({
    secret: 'JWT_SECRET',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Use false in development (set to true in production for HTTPS)
        // Cookie expiration time (1 day)
    }
}));

app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});
// Routes to render different pages
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});


// WebSocket for Real-Time Updates
io.on("connection", (socket) => {
    console.log("Driver Connected:", socket.id);

    socket.on("joinDriverRoom", (driverId) => {
        socket.join(driverId);
        console.log(`Driver ${socket.id} joined room: ${driverId}`);

        // Debugging: Check which rooms the driver is in
        console.log("Socket rooms:", socket.rooms);
    });

    // Driver joins a room based on driverId
    socket.on('newBookingRequest', async (data) => {
        const { bookingId, status } = data;

        await Booking.findByIdAndUpdate(bookingId, { status });

        io.to(data.patientName).emit('bookingStatusUpdate', { bookingId, status });
    });

    // Notify driver when a new booking is assigned
    socket.on("acceptBooking", ({ bookingId, driverId }) => {
        console.log("📥 Accept Booking Request Received:");
        console.log("📌 Driver ID:", driverId);
        console.log("📌 Booking ID:", bookingId);
    
        // Validate Driver ID
        if (!driverId || driverId.length !== 24) {
            console.error("❌ ERROR: Invalid Driver ID received:", driverId);
            return;
        }
    
        // Validate Booking ID
        if (!bookingId || bookingId.length !== 24) {
            console.error("❌ ERROR: Invalid Booking ID received:", bookingId);
            return;
        }
    
        console.log(`✅ Booking ${bookingId} accepted by Driver ${driverId}`);
    
        // Notify the user that the driver accepted the request
        io.to(driverId).emit("bookingAccepted", { driverId, bookingId });
    });
    

    // Notify driver when appointment is updated
    socket.on("updateAppointment", async ({ appointmentId, status, doctorId }) => {
        await Appointment.findByIdAndUpdate(appointmentId, { status });

        // Notify the **specific doctor** about the appointment update
        io.to(doctorId).emit("appointmentUpdated", { appointmentId, status });
    });

    // Driver status update
    socket.on("driverStatusChange", (data) => {
        io.emit("updateDriverStatus", data);
    });

    // Disconnect event
    socket.on("disconnect", () => {
        console.log("Driver Disconnected:", socket.id);
    });
});

app.use('/user', userRoutes);
app.use('/driver', driverRoutes);
app.use('/doctor', doctorRoutes);
app.use("/api", appointmentRoutes);
app.use('/location', locationRoutes);
app.use('/book', bookingRoutes(io));
app.use("/hospital", hospitalRoutes);

app.get('/driver-dashboard', async (req, res) => {
    try {
        // Retrieve the driver's ID from the session
        const driverId = req.session.driverId;
        if (!driverId) {
            return res.redirect('/driver-login'); // Redirect if not logged in
        }

        // Fetch the full driver object from the database
        const driver = await Driver.findById(driverId);
        if (!driver) {
            return res.status(404).send('Driver not found');
        }

        // Pass the driver object to the view
        res.render('driver-dashboard', { driver });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading driver dashboard');
    }
});

// Doctor Dashboard Route
app.get('/doctor-dashboard', async (req, res) => {
    const doctorId = req.session.doctorId;
    if (!doctorId) {
        return res.redirect('/doctor-login'); // Redirect to login if not authenticated
    }

    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
        return res.status(404).send('Doctor not found');
    }

    res.render('doctor-dashboard', {doctor}); // Render the doctor dashboard
});

app.get('/hospital-dashboard', async (req, res) => {
    try {
        const hospitalId = req.session.hospitalId;
        if (!hospitalId) {
            return res.redirect('/hospital-login'); // Redirect to login if not authenticated
        }

        // Fetch hospital details
        const hospital = await Hospital.findById(hospitalId);
        if (!hospital) {
            return res.status(404).send('Hospital not found');
        }

        // Fetch doctors associated with this hospital
        const doctors = await Doctor.find({ hospital: hospitalId });

        res.render('hospital-dashboard', { hospital, doctors }); // Pass doctors to EJS
    } catch (error) {
        console.error("Error loading hospital dashboard:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/emergency-map', (req, res) => {
    res.render('emergency-map'); // assuming emergency-map.ejs is the map page
});

app.get('/department', (req, res) => {
    res.render('department');
});

app.post('/about', (req, res) => {
    res.render('about');
});

app.post('/safety', (req, res) => {
    res.render('safety');
});

app.get('/about', (req, res) => {
    res.render('about', {user: req.session.user});
});

app.get('/safety', (req, res) => {
    res.render('safety', {user: req.session.user});
});


app.get('/user-login', (req, res) => {
    res.render('user-login');
});

app.get("/driver-login", async (req, res) => {
    try {
      const hospitals = await Hospital.find({}, "name"); // Fetch only hospital names
      res.render("driver-login", { hospitals, error_msg: req.flash("error") });
    } catch (error) {
      console.error("Error fetching hospitals:", error);
      res.render("driver-login", { hospitals: [], error_msg: "Failed to load hospitals" });
    }
  });

app.get("/doctor-login", async (req, res) => {
    try {
      const hospitals = await Hospital.find({}, "name"); // Fetch only hospital names
      res.render("doctor-login", { hospitals, error_msg: req.flash("error") });
    } catch (error) {
      console.error("Error fetching hospitals:", error);
      res.render("doctor-login", { hospitals: [], error_msg: "Failed to load hospitals" });
    }
  });

app.get('/hospital-login', (req, res) => {
    res.render('hospital-login');
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Failed to destroy session:', err);
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.redirect('/'); // Redirect to the login page
    });
});

app.post("/set-location", (req, res) => {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).send("Latitude and longitude are required");
    }

    req.session.userLocation = { latitude, longitude };

    res.send("Location updated successfully");
});

app.get("/set-location", (req, res) => {
    const { latitude, longitude } = req.query;
    if (latitude && longitude) {
        req.session.userLocation = { latitude: parseFloat(latitude), longitude: parseFloat(longitude) };
        res.send("Location updated");
    } else {
        res.status(400).send("Invalid coordinates");
    }
});


app.get("/user-map", async (req, res) => {
    const { driverId, userId, lat, lng } = req.query;
    
    console.log("Driver ID:", driverId);
    console.log("User ID:", userId || "Guest User"); 
    console.log("User Location:", lat, lng);

    if (!driverId) {
        return res.status(400).send("Driver ID is required.");
    }

    res.render("user-map", { driverId, userId: userId || null, lat, lng });
});

// app.js
app.post('/update-driver-location', async (req, res) => {
    const { driverId, latitude, longitude } = req.body;

    try {
        const driver = await Driver.findById(driverId);
        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }

        // Update the driver's location in the database
        driver.latitude = latitude;
        driver.longitude = longitude;
        await driver.save();

        res.status(200).json({ success: true, message: 'Driver location updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update driver location' });
    }
});

app.get("/get-locations", async (req, res) => {
    const { driverId, userId } = req.query;

    if (!driverId || !userId) {
        return res.status(400).json({ error: "Driver ID and User ID are required." });
    }

    const driver = await Driver.findById(driverId);
    const booking = await Booking.findOne({ userId }).sort({ createdAt: -1 });

    if (!driver || !booking) {
        return res.status(404).json({ error: "Driver or User location not found." });
    }

    res.json({
        driver: { lat: driver.latitude, lng: driver.longitude },
        user: { lat: booking.userLat, lng: booking.userLng }
    });
});

app.get('/get-user-location', (req, res) => {
    const location = req.session.userLocation;
    
    if (location) {
        res.json({
            lat: location.latitude,
            lng: location.longitude
        });
    } else {
        res.status(404).json({ message: 'User location not found' });
    }
});

// Emergency Button Route
app.get('/emergency', (req, res) => {
    if (!req.session.userLocation) {
        return res.send("User location is not set. Please allow location access.");
    }
    res.redirect('/driver/emergency');
});



app.get('/drivers', async (req, res) => {
    try {
        const drivers = await Driver.find();
        if (!drivers || drivers.length === 0) {
            return res.status(404).send('No drivers found');
        }

        // Render the template with all driver data
        res.render('available-driver', { drivers });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/doctor-profile/:id/profile-picture', async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id);
        if (!doctor || !doctor.profilePicture || !doctor.profilePicture.data) {
            return res.redirect('/default-avatar.png'); // Default image
        }

        res.set('Content-Type', doctor.profilePicture.contentType);
        res.send(doctor.profilePicture.data);
    } catch (error) {
        console.error("Error retrieving profile picture:", error);
        res.status(500).send('Error retrieving profile picture');
    }
});



// Get all doctors
app.get('/doctors', async (req, res) => {
    try {
        console.log("Session UserID:", req.session.userId); // Debugging

        const department = req.query.department;
        let doctors;

        if (department) {
            doctors = await Doctor.find({ department });
        } else {
            doctors = await Doctor.find();
        }

        if (!doctors || doctors.length === 0) {
            return res.status(404).send('No doctors found');
        }

        // Fetch user details from database using userId stored in session
        let user = null;
        if (req.session.userId) {
            user = await User.findById(req.session.userId);
        }

        res.render('available-doctor', { user, doctors, department }); // Pass user, doctors, and department
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});





// Run cleanup every hour
// Schedule a job to run every 2 minutes (for testing)

cron.schedule("0 0 * * *", async () => {
    try {
        const now = new Date();
        
        // Delete appointments older than today
        const result = await Appointment.deleteMany({
            date: { $lt: now.toISOString().split('T')[0] } // Only past dates
        });

        console.log(`${result.deletedCount} old appointments deleted.`);
    } catch (error) {
        console.error("Error deleting old appointments:", error);
    }
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
