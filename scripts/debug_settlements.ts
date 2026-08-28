import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const expenseSchema = new mongoose.Schema({}, { strict: false });
const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema, 'expenses');
const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.models.User || mongoose.model('User', userSchema, 'users');

async function main() {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log('✅ Connected\n');

    const user: any = await User.findOne({ email: 'msms5476@gmail.com' }).lean();
    const userId = user._id.toString();
    console.log(`👤 userId: ${userId}\n`);

    // Pull ALL 24 expenses that have user's split as isPaid:false
    const expenses: any[] = await Expense.find({
        isArchived: false,
        paidBy: { $ne: userId },
        splits: { $elemMatch: { userId, isPaid: false } },
    })
        .select('title amountBase isSettled isArchived paidBy splits date tripId')
        .lean();

    console.log(`Total: ${expenses.length} expenses with your split marked isPaid:false\n`);

    let totalAmount = 0;
    for (const e of expenses) {
        const mySplit = e.splits?.find((s: any) => s.userId?.toString() === userId);
        console.log(`📌 "${e.title}"`);
        console.log(`   Date     : ${e.date}`);
        console.log(`   Trip     : ${e.tripId}`);
        console.log(`   isSettled: ${e.isSettled} | isArchived: ${e.isArchived}`);
        console.log(`   paidBy   : ${e.paidBy}`);
        console.log(`   My split : amount=${mySplit?.amountBase} | isPaid=${mySplit?.isPaid}`);
        totalAmount += mySplit?.amountBase || 0;
        console.log('');
    }

    console.log(`💰 Total you still "owe" according to DB: ₹${totalAmount}`);
    console.log('\n⚡ CONCLUSION:');
    console.log('   These 24 expenses have your split.isPaid = false in the database.');
    console.log('   The settlements PAGE shows ₹0 because it uses the minimum-transaction');
    console.log('   algorithm which NETS balances across all expenses — if overall you paid');
    console.log('   more than you owe, net = 0. But individually these splits are still unpaid.');
    console.log('\n   FIX OPTIONS:');
    console.log('   1. The dashboard pendingSettlements count should be based on the same');
    console.log('      net-balance logic, not raw split counts');
    console.log('   2. OR: When a settlement is confirmed, mark the splits isPaid=true');

    await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
