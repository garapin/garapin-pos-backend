import { connectTargetDatabase } from "../config/targetDatabase.js";
import { UserModel } from "../models/userModel.js";
import { rakSchema } from "../models/rakModel.js";
import { positionSchema, STATUS_POSITION } from "../models/positionModel.js";
import moment from "moment";

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
  async schedulerStatusPosition() {
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
          const positionModelStore = storeDatabase.model(
            "position",
            positionSchema
          );

          const filter = { status: { $ne: "DELETED" } };
          const allRaks = await rakModelStore.find(filter).populate({
            path: "positions",
          });

          for (let rak of allRaks) {
            const positionPromises = rak.positions.map(async (position) => {
              if (position?.end_date) {
                //jika end date ada ini yang akan di update
                const today = new Date();
                const positionEndDate = new Date(position.end_date);
                const isRent = positionEndDate.getTime() < today.getTime(); // end day lebih besar dari today

                if (!isRent) {
                  //end tidak lebih besar dari today
                  position.status = STATUS_POSITION.RENTED;
                } else if (position.status === STATUS_POSITION.UNPAID) {
                  //unpaid
                  position.status = STATUS_POSITION.UNPAID;
                } else {
                  //end lebih besar dari today dan bukan unpaid
                  const availableDate = new Date(position.available_date);
                  const isA = availableDate.getTime() > today.getTime(); //jika avaliabledate lebih besar dari today
                  if (!isA) {
                    //avaliabledate tidak lebih besar dari today
                    position.status = STATUS_POSITION.AVAILABLE;
                  } else {
                    //avaliabledate lebih besar dari today
                    position.status = "IN_COMING";
                  }
                }

                const updatePosition = {
                  name_position: position.name_position,
                  rak_id: position.rak_id,
                  row: position.row,
                  column: position.column,
                  height: position.height,
                  long_size: position.long_size,
                  status: position.status,
                  available_date: position.available_date,
                  create_by: position.createdAt,
                  updatedAt: new Date(),
                };

                const updateQuery = {
                  //update/ set
                  $set: updatePosition,
                };
                if (position.status === STATUS_POSITION.AVAILABLE) {
                  //jika status AVAILABLE gak perlu ada end_date, start_date, due_date
                  updateQuery.$unset = {
                    end_date: "",
                    start_date: "",
                    due_date: "",
                  };
                }

                await positionModelStore.updateOne(
                  { _id: position._id },
                  updateQuery
                );
              }
            });

            await Promise.all(positionPromises);
          }

          console.log(
            "Postion scheduling status updates completed successfully!"
          );
        } catch (error) {
          console.error("Error updating Postion status:", error); // Log specific errors
        }
      }
    } catch (error) {
      console.error("Error scheduling Postion status update:", error); // Log scheduling errors
    }
  }
  async schedulerStatusTransactionEngine() {
    // try {
    //   const user = await UserModel.findOne({});
    //   const allStoreRaku = user.store_database_name.filter((store) =>
    //     store.name.startsWith("om")
    //   );

    //   // for (let targetDatabase of allStoreRaku) {
    //   //   const storeDatabase = await connectTargetDatabase(targetDatabase.name);

    //   //   try {
    //   //     if (!storeDatabase.models.position) {
    //   //       storeDatabase.model("position", positionSchema);
    //   //     }
    //   //     if (!storeDatabase.models.rak) {
    //   //       storeDatabase.model("rak", rakSchema);
    //   //     }
    //   //     const rakModelStore = storeDatabase.model("rak");

    //   //     const filter = { status: { $ne: "DELETED" } };
    //   //     const allRaks = await rakModelStore.find(filter).populate({
    //   //       path: "positions",
    //   //     });

    //   //     for (let rak of allRaks) {
    //   //       const today = new Date();
    //   //       const tomorrow = new Date(today);
    //   //       tomorrow.setDate(today.getDate() - 5);

    //   //       rak.positions.forEach((position) => {
    //   //         if (position?.end_date) {
    //   //           const positionEndDate = new Date(position.end_date);
    //   //           const isRent = positionEndDate.getTime() < tomorrow.getTime();
    //   //           if (!isRent) {
    //   //             position.status = STATUS_POSITION.RENTED;
    //   //             rak.status = "AVAILABLE";
    //   //           } else {
    //   //             rak.status = "NOT AVAILABLE";
    //   //           }
    //   //         } else {
    //   //           if (position.status !== STATUS_POSITION.UNPAID) {
    //   //             position.status = STATUS_POSITION.AVAILABLE;
    //   //             rak.status = "AVAILABLE";
    //   //           } else {
    //   //             rak.status = "NOT AVAILABLE";
    //   //           }
    //   //         }
    //   //       });
    //   //     }

    //   //     await Promise.all(
    //   //       allRaks.map(async (rak) => {
    //   //         const updatedRak = {
    //   //           name: rak.name,
    //   //           sku: rak.sku,
    //   //           image: rak.image,
    //   //           height: rak.height,
    //   //           long_size: rak.long_size,
    //   //           discount: rak.discount,
    //   //           price_perday: rak.price_perday,
    //   //           rent: rak.rent,
    //   //           status: rak.status,
    //   //           updatedAt: new Date(),
    //   //         };
    //   //         return await rakModelStore.updateOne(
    //   //           { _id: rak._id },
    //   //           { $set: updatedRak }
    //   //         );
    //   //       })
    //   //     );

    //   //     console.log("Rak scheduling status updates completed successfully!");
    //   //   } catch (error) {
    //   //     console.error("Error updating rak status:", error); // Log specific errors
    //   //   }
    //   // }
    // } catch (error) {
    //   console.error("Error scheduling rak status update:", error); // Log scheduling errors
    // }
    const url = `${this.baseUrl}/transactions`;
    console.log(url);
  }
}
export default AnotherEngine;
