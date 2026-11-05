// Exports MongoDB orders to the CSV that ml-service/train.py reads.
//   npm run export                 -> ../ml-service/orders.csv
//   npm run export -- some/file.csv
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../config');
const Order = require('../models/Order');

const out = path.resolve(process.argv[2] || path.join(__dirname, '../../../ml-service/orders.csv'));
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function main() {
  await mongoose.connect(config.mongoUri);
  const stream = fs.createWriteStream(out);
  stream.write('customer_id,product_id,product_name,invoice_id,quantity,price,order_date\n');
  let rows = 0;
  for await (const o of Order.find({ status: { $ne: 'cancelled' } }).lean().cursor()) {
    for (const it of o.items) {
      stream.write([o.user, it.product, q(it.name), o._id, it.quantity, it.price, new Date(o.createdAt).toISOString()].join(',') + '\n');
      rows++;
    }
  }
  await new Promise((r) => stream.end(r));
  console.log(`Wrote ${rows} line items to ${out}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
