import { connectTargetDatabase } from "../config/targetDatabase.js";
import { UserModel } from "../models/userModel.js";
import { rakSchema } from "../models/rakModel.js";
import { positionSchema, STATUS_POSITION } from "../models/positionModel.js";
import moment from "moment";
import { configAppForPOSSchema } from "../models/configAppModel.js";

class AnotherEngine {
  constructor() {
    this.apiKey = process.env.XENDIT_API_KEY;
    this.accountId = process.env.XENDIT_ACCOUNT_GARAPIN;
    this.baseUrl = "https://api.xendit.co";
  }
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
          const confModel = storeDatabase.model(
            "config_app",
            configAppForPOSSchema
          );
          const configApp = await confModel.findOne();

          const filter = { status: { $ne: "DELETED" } };
          const allRaks = await rakModelStore.find(filter).populate({
            path: "positions",
          });

          const updatedRaks = await Promise.all(
            allRaks.map(async (rak) => {
              rak.image = await showImage(req, rak.image);
              rak.positions.forEach((position) => {
                const today = new Date();
                const endDate = new Date(position.end_date);
                const startDate = new Date(position.start_date);
                const dueDateInDays = configApp.due_date; //2
                const payDuration = configApp.payment_duration * 60 * 1000; //1200

                if (position?.end_date) {
                  if (position.status === "RENT") {
                    const endDateWithDueDate = new Date(endDate);
                    endDateWithDueDate.setDate(
                      endDate.getDate() + dueDateInDays
                    );
                    position.available_date = endDateWithDueDate;
                    if (
                      today.getDate() > endDate.getDate() &&
                      today.getDate() <= endDateWithDueDate.getDate()
                    ) {
                      position.status = "INCOMING";
                    } else if (today.getDate() > endDateWithDueDate.getDate()) {
                      position.status = "AVAILABLE";
                    }
                  } else if (position.status === "UNPAID") {
                    const nowNPayDuration = new Date(
                      today.getTime() + payDuration
                    );
                    if (startDate.getTime() < nowNPayDuration.getTime()) {
                      position.status = "AVAILABLE";
                      position.available_date = today;
                    }
                  } else if (position.status === "EXPIRED") {
                    position.status = "AVAILABLE";
                    position.available_date = today;
                  }
                }
              });
              return rak;
            })
          );

          for (let rak of updatedRaks) {
            const xs = rak.positions.filter((x) => x.status === "AVAILABLE");
            rak.status = xs.length > 0 ? "AVAILABLE" : "NOT AVAILABLE";
          }

          await Promise.all(
            updatedRaks.map(async (rak) => {
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
  // async schedulerStatusPosition() {
  //   try {
  //     const user = await UserModel.findOne({});
  //     const allStoreRaku = user.store_database_name.filter((store) =>
  //       store.name.startsWith("om")
  //     );

  //     for (let targetDatabase of allStoreRaku) {
  //       const storeDatabase = await connectTargetDatabase(targetDatabase.name);

  //       try {
  //         if (!storeDatabase.models.position) {
  //           storeDatabase.model("position", positionSchema);
  //         }
  //         if (!storeDatabase.models.rak) {
  //           storeDatabase.model("rak", rakSchema);
  //         }
  //         const rakModelStore = storeDatabase.model("rak");
  //         const positionModelStore = storeDatabase.model(
  //           "position",
  //           positionSchema
  //         );
  //         const confModel = storeDatabase.model(
  //           "config_app",
  //           configAppForPOSSchema
  //         );
  //         const configApp = await confModel.findOne();

  //         const filter = { status: { $ne: "DELETED" } };
  //         const allRaks = await rakModelStore.find(filter).populate({
  //           path: "positions",
  //         });

  //         const updatedRaks = await Promise.all(
  //           allRaks.map(async (rak) => {
  //             rak.image = await showImage(req, rak.image);
  //             rak.positions.forEach((position) => {
  //               const today = new Date();
  //               const endDate = new Date(position.end_date);
  //               const startDate = new Date(position.start_date);
  //               const dueDateInDays = configApp.due_date; //2
  //               const payDuration = configApp.payment_duration * 60 * 1000; //1200

  //               if (position?.end_date) {
  //                 if (position.status === "RENT") {
  //                   const endDateWithDueDate = new Date(endDate);
  //                   endDateWithDueDate.setDate(
  //                     endDate.getDate() + dueDateInDays
  //                   );
  //                   position.available_date = endDateWithDueDate;
  //                   if (
  //                     today.getDate() > endDate.getDate() &&
  //                     today.getDate() <= endDateWithDueDate.getDate()
  //                   ) {
  //                     position.status = "INCOMING";
  //                   } else if (today.getDate() > endDateWithDueDate.getDate()) {
  //                     position.status = "AVAILABLE";
  //                   }
  //                 } else if (position.status === "UNPAID") {
  //                   const nowNPayDuration = new Date(
  //                     today.getTime() + payDuration
  //                   );
  //                   if (startDate.getTime() < nowNPayDuration.getTime()) {
  //                     position.status = "AVAILABLE";
  //                     position.available_date = today;
  //                   }
  //                 } else if (position.status === "EXPIRED") {
  //                   position.status = "AVAILABLE";
  //                   position.available_date = today;
  //                 }
  //               }
  //             });
  //             return rak;
  //           })
  //         );

  //         for (let rak of allRaks) {

  //           const positionPromises = rak.positions.map(async (position) => {
  //             if (position?.end_date) {
  //               //jika end date ada ini yang akan di update
  //               const today = new Date();
  //               const endDate = new Date(position.end_date);

  //               if (position.start_date && position.end_date) {
  //                 //jika end lebih kecil dari today status IN_COMING
  //                 // if (endDate.getDate() < today.getDate()) {
  //                 if (position.status === "RENT") {
  //                   if (endDate.getDate() + 2 > today.getDate()) {
  //                     position.status = "IN_COMING";
  //                   }
  //                 } else if (endDate.getDate() < today.getDate()) {
  //                   //jika endDate lebih kecil dari today
  //                   position.available_date = today;
  //                 } else {
  //                   position.available_date = today.setDate(
  //                     endDate.getDate() + 2
  //                   );
  //                 }
  //                 position.due_date = endDate;
  //               }

  //               const updatePosition = {
  //                 name_position: position.name_position,
  //                 rak_id: position.rak_id,
  //                 row: position.row,
  //                 column: position.column,
  //                 height: position.height,
  //                 long_size: position.long_size,
  //                 status: position.status,
  //                 available_date: position.available_date,
  //                 create_by: position.createdAt,
  //                 updatedAt: new Date(),
  //               };
  //               console.log("====================================");
  //               console.log("updatePosition", updatePosition);
  //               console.log("====================================");

  //               const updateQuery = {
  //                 //update/ set
  //                 $set: updatePosition,
  //               };
  //               if (position.status === STATUS_POSITION.AVAILABLE) {
  //                 //jika status AVAILABLE gak perlu ada end_date, start_date, due_date
  //                 updateQuery.$unset = {
  //                   end_date: "",
  //                   start_date: "",
  //                   due_date: "",
  //                 };
  //               }

  //               await positionModelStore.updateOne(
  //                 { _id: position._id },
  //                 updateQuery
  //               );
  //             }
  //           });

  //           await Promise.all(positionPromises);
  //         }

  //         console.log(
  //           "Postion scheduling status updates completed successfully!"
  //         );
  //       } catch (error) {
  //         console.error("Error updating Postion status:", error); // Log specific errors
  //       }
  //     }
  //   } catch (error) {
  //     console.error("Error scheduling Postion status update:", error); // Log scheduling errors
  //   }
  // }
  // async schedulerStatusTransactionEngine() {
  //   // try {
  //   //   const user = await UserModel.findOne({});
  //   //   const allStoreRaku = user.store_database_name.filter((store) =>
  //   //     store.name.startsWith("om")
  //   //   );

  //   //   // for (let targetDatabase of allStoreRaku) {
  //   //   //   const storeDatabase = await connectTargetDatabase(targetDatabase.name);

  //   //   //   try {
  //   //   //     if (!storeDatabase.models.position) {
  //   //   //       storeDatabase.model("position", positionSchema);
  //   //   //     }
  //   //   //     if (!storeDatabase.models.rak) {
  //   //   //       storeDatabase.model("rak", rakSchema);
  //   //   //     }
  //   //   //     const rakModelStore = storeDatabase.model("rak");

  //   //   //     const filter = { status: { $ne: "DELETED" } };
  //   //   //     const allRaks = await rakModelStore.find(filter).populate({
  //   //   //       path: "positions",
  //   //   //     });

  //   //   //     for (let rak of allRaks) {
  //   //   //       const today = new Date();
  //   //   //       const tomorrow = new Date(today);
  //   //   //       tomorrow.setDate(today.getDate() - 5);

  //   //   //       rak.positions.forEach((position) => {
  //   //   //         if (position?.end_date) {
  //   //   //           const endDate = new Date(position.end_date);
  //   //   //           const isRent = endDate.getTime() < tomorrow.getTime();
  //   //   //           if (!isRent) {
  //   //   //             position.status = STATUS_POSITION.RENTED;
  //   //   //             rak.status = "AVAILABLE";
  //   //   //           } else {
  //   //   //             rak.status = "NOT AVAILABLE";
  //   //   //           }
  //   //   //         } else {
  //   //   //           if (position.status !== STATUS_POSITION.UNPAID) {
  //   //   //             position.status = STATUS_POSITION.AVAILABLE;
  //   //   //             rak.status = "AVAILABLE";
  //   //   //           } else {
  //   //   //             rak.status = "NOT AVAILABLE";
  //   //   //           }
  //   //   //         }
  //   //   //       });
  //   //   //     }

  //   //   //     await Promise.all(
  //   //   //       allRaks.map(async (rak) => {
  //   //   //         const updatedRak = {
  //   //   //           name: rak.name,
  //   //   //           sku: rak.sku,
  //   //   //           image: rak.image,
  //   //   //           height: rak.height,
  //   //   //           long_size: rak.long_size,
  //   //   //           discount: rak.discount,
  //   //   //           price_perday: rak.price_perday,
  //   //   //           rent: rak.rent,
  //   //   //           status: rak.status,
  //   //   //           updatedAt: new Date(),
  //   //   //         };
  //   //   //         return await rakModelStore.updateOne(
  //   //   //           { _id: rak._id },
  //   //   //           { $set: updatedRak }
  //   //   //         );
  //   //   //       })
  //   //   //     );

  //   //   //     console.log("Rak scheduling status updates completed successfully!");
  //   //   //   } catch (error) {
  //   //   //     console.error("Error updating rak status:", error); // Log specific errors
  //   //   //   }
  //   //   // }
  //   // } catch (error) {
  //   //   console.error("Error scheduling rak status update:", error); // Log scheduling errors
  //   // }
  //   const url = `${this.baseUrl}/transactions`;
  //   console.log(url);
  // }
}
export default AnotherEngine;
