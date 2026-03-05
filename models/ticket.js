const mongoose = require("mongoose")

const ticketSchema = new mongoose.Schema({

title:String,

description:String,

category:String,

priority:String,

status:{
type:String,
default:"Open"
},

assignedTo:String,

attachments:[String],

deviceInfo:{
ram:String,
cpu:String,
battery:String,
network:String
},

meeting:{
title:String,
date:String,
startTime:String,
endTime:String
},

createdAt:{
type:Date,
default:Date.now
}

})

module.exports = mongoose.model("Ticket",ticketSchema)