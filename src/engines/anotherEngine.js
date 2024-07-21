import { connectTargetDatabase } from "../config/targetDatabase.js";
import { UserModel } from "../models/userModel.js";
import { rakSchema } from "../models/rakModel.js";
import { positionSchema, STATUS_POSITION } from "../models/positionModel.js";

class AnotherEngine {
  constructor() {}
  async schedulerStatusRakEngine() {
    try {
      const user = await UserModel.findOne({});
      const allStoreRaku = user.store_database_name.filter((store) =>
        store.name.startsWith("om")
      );

      for (let targetDatabase of allStoreRaku) {
        const storeDatabase = await connectTargetDatabase(targetDatabase.name);

        try {
          if (!storeDatabase.models.position) {
            storeDatabase.model("position", positionSchema);
          }
          if (!storeDatabase.models.rak) {
            storeDatabase.model("rak", rakSchema);
          }
          const rakModelStore = storeDatabase.model("rak");

          const filter = { status: { $ne: "DELETED" } };
          const allRaks = await rakModelStore.find(filter).populate({
            path: "positions",
          });

          for (let rak of allRaks) {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() - 5);

            rak.positions.forEach((position) => {
              if (position?.end_date) {
                const positionEndDate = new Date(position.end_date);
                const isRent = positionEndDate.getTime() < tomorrow.getTime();
                if (!isRent) {
                  position.status = STATUS_POSITION.RENTED;
                  rak.status = "AVAILABLE";
                } else {
                  rak.status = "NOT AVAILABLE";
                }
              } else {
                if (position.status !== STATUS_POSITION.UNPAID) {
                  position.status = STATUS_POSITION.AVAILABLE;
                  rak.status = "AVAILABLE";
                } else {
                  rak.status = "NOT AVAILABLE";
                }
              }
            });
          }

          await Promise.all(
            allRaks.map(async (rak) => {
              const updatedRak = {
                name: rak.name,
                sku: rak.sku,
                image: rak.image,
                height: rak.height,
                long_size: rak.long_size,
                discount: rak.discount,
                price_perday: rak.price_perday,
                rent: rak.rent,
                status: rak.status,
                updatedAt: new Date(),
              };
              return await rakModelStore.updateOne(
                { _id: rak._id },
                { $set: updatedRak }
              );
            })
          );

          console.log("Rak scheduling status updates completed successfully!");
        } catch (error) {
          console.error("Error updating rak status:", error); // Log specific errors
        }
      }
    } catch (error) {
      console.error("Error scheduling rak status update:", error); // Log scheduling errors
    }
  }
}
export default AnotherEngine;
