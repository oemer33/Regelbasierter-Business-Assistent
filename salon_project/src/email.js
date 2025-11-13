const nodemailer=require("nodemailer");
function makeTransport(env){return nodemailer.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||587),secure:String(env.SMTP_SECURE||"false")==="true",auth:{user:env.SMTP_USER,pass:env.SMTP_PASS}});}
async function sendAppointmentMail(t,env,a){await t.sendMail({from:env.FROM_ADDRESS||env.SMTP_USER,to:env.TEAM_INBOX,subject:`Terminanfrage ${a.name}`,html:`<p>${a.name}<br>${a.service}<br>${a.datetime}<br>${a.contact}</p>`});}
module.exports={makeTransport,sendAppointmentMail};