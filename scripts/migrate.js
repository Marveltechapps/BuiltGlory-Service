import { connectDatabase, disconnectDatabase } from "../src/database/connection.js";
import { Admin } from "../src/modules/admins/admins.model.js";
import { User } from "../src/modules/users/users.model.js";
import { Property } from "../src/modules/properties/properties.model.js";

try {
  await connectDatabase();
  await Promise.all([Admin.syncIndexes(), User.syncIndexes(), Property.syncIndexes()]);
  console.log("Core indexes synchronized");
} finally {
  await disconnectDatabase();
}
