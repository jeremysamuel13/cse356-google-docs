import { createTransport } from 'nodemailer'
import { connect, ConsumeMessage } from 'amqplib'
import dotenv from 'dotenv'
import MailMessage from 'nodemailer/lib/mailer/mail-message'

export const transport = createTransport({
    sendmail: true,
    path: '/usr/sbin/sendmail',
    newline: 'unix'
})

dotenv.config()

export const { AMQP_URL, QUEUE_NAME, EMAIL_SENDER } = process.env;


const conn = await connect(AMQP_URL!)
const channel = await conn.createChannel()
await channel.assertQueue(QUEUE_NAME!)
channel.prefetch(5)

await channel.consume(QUEUE_NAME!, async (msg: ConsumeMessage | null) => {
    if (!msg) {
        return
    }

    const decoded: MailMessage = JSON.parse(msg.content.toString())
    await transport.sendMail({ ...decoded, from: EMAIL_SENDER! })
}, { noAck: true })
