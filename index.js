const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express()
const port = process.env.PORT || 5000;



// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gyudr.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctors-portal').collection('services');
        const bookingCollection = client.db('doctors-portal').collection('booking');

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query)
            const services = await cursor.toArray()
            res.send(services);

        })

        app.get('/available', async (req, res) => {
            const date = req.query.date;
            // step 1:  get all services
            const services = await serviceCollection.find().toArray()

            // step 2: get the booking of that day
            const query = { date: date };
            const booking = await bookingCollection.find(query).toArray()

            // step 3: for each service
            services.forEach(service => {
                // step 4: find bookings for that service. 
                const serviceBooking = booking.filter(book => book.treatment === service.name);

                // step 5: select slots for the service Bookings: 
                const bookedSlots = serviceBooking.map(book => book.slot)

                // step 6: select those slots that are not in bookedSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot))

                //step 7: set available to slots to make it easier 
                service.slots = available;

            })
            res.send(services);

        })

        // insert a data to the data base
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exist = await bookingCollection.findOne(query);

            if (exist) {
                return res.send({ success: false, booking: exist })
            }

            const result = await bookingCollection.insertOne(booking);
            res.send({ success: true, result });

        })

    }
    finally {
    }
}

run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('doctors portal is running')
})

app.listen(port, console.dir(`doctors portal is running form, ${port}`))