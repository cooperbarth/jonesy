const maxAPI = require("max-api");
const pizzaAPI = require("dominos");

maxAPI.post("Node.js Process Running");

maxAPI.addHandlers({
    findNearestStore: address => {
        pizzaAPI.Util.findNearbyStores(address.toString(), "Delivery", storeData => {
            if (storeData.success) {
                const stores = storeData.result.Stores;
                if (stores.length === 0) {
                    maxAPI.post("No stores found.", maxAPI.POST_LEVELS.ERROR);
                    return;
                }
                maxAPI.post(`The ID of the closest store is ${stores[0].StoreID}`);
                maxAPI.outlet(stores[0].StoreID);
            } else {
                maxAPI.post("Error finding nearby stores.", maxAPI.POST_LEVELS.ERROR);
                maxAPI.post(storeData.message);
            }
        });
    },
    getMenu: storeID => {
        const store = new pizzaAPI.Store(storeID);
        store.ID = storeID;
        store.getMenu(menu => {
            if ("success" in menu && menu.success == false) {
                maxAPI.post(`Error retrieving menu for store ${storeID}.`, maxAPI.POST_LEVELS.ERROR);
            } else if (menu.menuData.success) {
                maxAPI.post(Object.entries(menu.menuByCode).map(item => (`${item[0]}: ${item[1].menuData.Name}`)));
            } else {
                maxAPI.post(`Error retrieving menu for store ${storeID}.`, maxAPI.POST_LEVELS.ERROR);
            }
        });
    },
    order: (firstName, lastName, address, email, phone, storeID, deliveryMethod, itemCodes, cardNumber, expiration, security, zip) => {
        const customer = new pizzaAPI.Customer({
            firstName: firstName,
            lastName: lastName,
            address: address,
            email: email,
            phone: phone
        });

        const order = new pizzaAPI.Order({
            customer: customer,
            storeID: storeID,
            deliveryMethod: "Delivery"
        });

        for (let itemCode of itemCodes) {
            order.addItem(
                new pizzaAPI.Item({
                    code: itemCode,
                    options: [],
                    quantity: 1
                })
            );
        }

        order.validate(() => {
            order.price(() => {
                const cardInfo = new order.PaymentObject();
                cardInfo.Amount = order.Amounts.Customer;
                cardInfo.Number = cardNumber;
                cardInfo.CardType = order.validateCC(cardNumber);
                cardInfo.Expiration = expiration;
                cardInfo.SecurityCode = security;
                cardInfo.PostalCode = zip;
                
                order.Payments.push(cardInfo);
                order.place(order => {
                    if (order.success) {
                        if (order.result.Status === -1) {
                            console.log(`Order failed with status code ${order.result.StatusItems[0].Code}.`);
                        } else {
                            console.log(order);
                        }
                    } else {
                        console.log(order);
                    }
                });
            });
        });
    }
});