const Ticket = require("../models/ticket")

exports.createTicket = async (req,res)=>{

try{

let screenshotPath=""

if(req.file){
screenshotPath=req.file.path
}

const ticket = new Ticket({

title:req.body.title,
description:req.body.description,
category:req.body.category,
priority:req.body.priority,
attachments:screenshotPath?[screenshotPath]:[]

})

await ticket.save()

res.json({
message:"Ticket Created",
ticket
})

}catch(err){
res.status(500).json(err)
}

}

exports.getTickets = async(req,res)=>{

try{

const tickets = await Ticket.find()

res.json(tickets)

}catch(err){

res.status(500).json(err)

}

}