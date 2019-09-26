const maxAPI = require("max-api");
const pizzaAPI = require("dominos");

maxAPI.post("Node.js Process Running");

let itemCodes = [];
let customer = new pizzaAPI.Customer();

function getNearestStore(address, callback) {
    pizzaAPI.Util.findNearbyStores(address.toString(), "Delivery", storeData => {
        if (storeData.success) {
            const stores = storeData.result.Stores;
            if (stores.length === 0) {
                callback("No stores found.", true);
                return;
            }
            callback(stores[0].StoreID);
        } else {
            callback("Error finding nearby stores.", true);
        }
    });
}

maxAPI.addHandlers({
    getNearestMenu: address => {
        getNearestStore(address, (storeID, err) => {
            if (err) {
                maxAPI.post(storeID, maxAPI.POST_LEVELS.ERROR);
                return;
            }
            const store = new pizzaAPI.Store(storeID);
            store.ID = storeID;
            store.getMenu(menu => {
                if ("success" in menu && menu.success == false) {
                    maxAPI.post(`Error retrieving menu for store ${storeID}.`, maxAPI.POST_LEVELS.ERROR);
                } else if (menu.menuData.success) {
                    maxAPI.post(Object.entries(menu.menuByCode).map(item => (`${item[0]}: ${item[1].menuData.Name}\n`)), maxAPI.POST_LEVELS.INFO);
                    maxAPI.post(`The nearest store has ID ${storeID}.`);
                } else {
                    maxAPI.post(`Error retrieving menu for store ${storeID}.`, maxAPI.POST_LEVELS.ERROR);
                }
            });
        })
    },
    addItems: items => {
        itemCodes = items.split(" ");
        maxAPI.post("Items for order set.");
    },
    addCustomer: (firstName, lastName, address, email, phoneNumber) => {
        customer = new pizzaAPI.Customer({
            firstName: firstName,
            lastName: lastName,
            address: address,
            email: email,
            phoneNumber: phoneNumber
        });
        maxAPI.post("Customer added.");
    },
    order: (storeID, cardNumber, expiration, security, zip) => {
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
                            maxAPI.post(order.result);
                            maxAPI.post(`Order failed with status code ${order.result.StatusItems[0].Code}.`, maxAPI.POST_LEVELS.ERROR);
                        } else {
                            maxAPI.post(order, maxAPI.POST_LEVELS.INFO);
                        }
                    } else {
                        maxAPI.post("Order failed.", maxAPI.POST_LEVELS.ERROR);
                    }
                });
            });
        });
    }
});