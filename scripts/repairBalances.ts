import mongoose from 'mongoose';
import { config } from '../src/config';
import { Trip } from '../src/modules/trips/trip.model';
import { Expense } from '../src/modules/expense/expense.model';

async function repair() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('Connected!');

    const trips = await Trip.find({});
    console.log(`Found ${trips.length} trips to check...`);

    for (const trip of trips) {
        console.log(`\nRepairing Trip: ${trip.title} (${trip._id})`);

        // Reset all member balances to 0
        for (const member of trip.members) {
            member.totalPaidBase = 0;
            member.totalOwesBase = 0;
        }

        const expenses = await Expense.find({ tripId: trip._id });
        console.log(`Found ${expenses.length} expenses in this trip.`);

        let tripTotalSpentLocal = 0;
        let tripTotalSpentBase = 0;

        // Recalculate from expenses
        for (const exp of expenses) {
            tripTotalSpentLocal += exp.amountLocal;
            tripTotalSpentBase += exp.amountBase;

            // Payer paid this much
            const payer = trip.members.find(m => m.userId.toString() === exp.paidBy.toString());
            if (payer) {
                payer.totalPaidBase += exp.amountBase;
            }

            // Everyone owes their split
            for (const split of exp.splits) {
                const consumer = trip.members.find(m => m.userId.toString() === split.userId.toString());
                if (consumer) {
                    consumer.totalOwesBase += split.amountBase;
                }
            }
        }

        // Apply and save
        trip.totalSpentBase = tripTotalSpentBase;

        let dirty = false;
        trip.members.forEach(m => {
            m.totalPaidBase = parseFloat(m.totalPaidBase.toFixed(2));
            m.totalOwesBase = parseFloat(m.totalOwesBase.toFixed(2));
            console.log(`- Member ${m.displayName}: Paid = ${m.totalPaidBase}, Owes = ${m.totalOwesBase}, Net = ${m.totalPaidBase - m.totalOwesBase}`);
        });

        await trip.save();
        console.log('Saved trip.');
    }

    console.log('\nRepair complete!');
    process.exit(0);
}

repair().catch(err => {
    console.error(err);
    process.exit(1);
});
