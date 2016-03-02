chatMessagesCollection = new Mongo.Collection("ChatMessages");

if (Meteor.isClient) {

    Meteor.subscribe("chatMessagesPublish");
    Meteor.subscribe("chatUsersPublish");

    Accounts.ui.config({
        passwordSignupFields: "USERNAME_ONLY"
    });
	
	Template.body.helpers({
        currentUser: function() {
            return Meteor.userId();
        }
    });

    Template.chat_template.helpers({
        chatMessages: function() {
            return chatMessagesCollection.find({}, {limit: 50}, {sort: {timestamp: -1}});
        },
        totalMessagesCount: function() {
            return chatMessagesCollection.find().count();
        },
        chatUsers: function() {
            return Meteor.users.find({}, {sort: {"profile.karma": -1}});
        }
    });

    Template.chat_template.events({
        "submit .new_message_form": function (event) {
            if (event.target.new_message_input.value) {
                event.preventDefault();
                var messageText = event.target.new_message_input.value;
                Meteor.call("addMessage", messageText);
                event.target.new_message_input.value = "";
				
				var objUl = document.getElementsByClassName("messages_ul")[0];
				objUl.scrollTop = objUl.scrollHeight;
			}
        }
    });

    Template.chat_message_template.helpers({
        isMessageOwner: function() {
            return this.authorID === Meteor.userId();
        }
    });

    Template.chat_message_template.events({
        "click .delete_message_button": function() {
            Meteor.call("deleteMessage", this._id);
        },
        "click .decrease_message_karma_button": function() {
            Meteor.call("changeKarma", this._id, this.authorID, Meteor.userId(), "decrease", function (error) {
                alert(error.reason);
            });
        },
        "click .increase_message_karma_button": function() {
            Meteor.call("changeKarma", this._id, this.authorID, Meteor.userId(), "increase", function (error) {
                alert(error.reason);
            });
        }
    });

}	// if (Meteor.isClient) {



if (Meteor.isServer) {

    Meteor.publish("chatMessagesPublish", function() {
        return chatMessagesCollection.find();
    });
    Meteor.publish("chatUsersPublish", function() {
        return Meteor.users.find();
    });

    Accounts.onCreateUser(function(options, user) {
        if (user.profile == undefined) user.profile = {};
        user.profile.karma = 0;
        return user;
    });

    Meteor.methods({
        addMessage: function (messageText) {
            chatMessagesCollection.insert({
                text: messageText,						        // текст сообщения
                timestamp: new Date(),					        // временная метка
                karma: 0,								// карма сообщения
                authorID: Meteor.userId(),				// ID пользователя
                authorUsername: Meteor.user().username,	// имя пользователя
                whoReacted: new Array()                 // хранит ID пользователей, оценивших сообщение
            });
        },
        deleteMessage: function (messageID) {
            chatMessagesCollection.remove(messageID);
        },
        changeKarma: function(messageID, authorID, reactedID, whatToDo) {
            if (chatMessagesCollection.findOne(messageID).whoReacted.indexOf(reactedID) > -1) {
                throw new Meteor.Error(500, "You've already checked this message");
            }

            var authorKarma = Meteor.users.findOne(authorID, {}).profile.karma;
            var reactedKarma = Meteor.users.findOne(reactedID, {}).profile.karma;
            var karmaChangeValue = 0.1;
            if (reactedKarma > 1) {
                karmaChangeValue = karmaChangeValue * reactedKarma.toFixed();
            }
            switch (whatToDo) {
                case "increase":
                chatMessagesCollection.update(messageID, {$inc: {karma: 1}});
                if (authorKarma >= 5) {
                    chatMessagesCollection.update(messageID, {$addToSet: {whoReacted: reactedID}});
                    return;
                }
                break;
                case "decrease":
                chatMessagesCollection.update(messageID, {$inc: {karma: -1}});
                if (authorKarma <= -5) {
                    chatMessagesCollection.update(messageID, {$addToSet: {whoReacted: reactedID}});
                    return;
                }
                karmaChangeValue = karmaChangeValue * -1;
                break;
                default:
                    throw new Meteor.Error(500, "Unknown operation");
            }
			authorKarma = (authorKarma * 10 + karmaChangeValue * 10) / 10;
			Meteor.users.update(authorID, {$set: {"profile.karma": authorKarma}});
            chatMessagesCollection.update(messageID, {$addToSet: {whoReacted: reactedID}});
        }
    });

}	// if (Meteor.isServer) {
