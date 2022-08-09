const userModel = require("../models/userModel")
const bcrypt = require("bcrypt")
const validator = require("../utility/validation")
const aws = require("../utility/awsconfig")
const jwt = require("jsonwebtoken")
const mongoose = require("mongoose")

const phoneRex = /^[6789][0-9]{9}$/

//create user
const createUser = async (req, res) => {
    try {
        //fetching data present in request body 
        let files = req.files;
        const requestBody = req.body
        
        if (!validator.isValidBody(requestBody)) return res.status(400).send({ status: false, message: 'Please provide user details' })
        //Destructuring requestBody
        let { fname, lname, phone, email, password, address  } = requestBody
        //------------------------------Validation starts-------------------------------
        //fname
        if (!validator.isValid(fname)) return res.status(400).send({ status: false, message: `fname is required` });
        if (!fname.trim().match(/^[a-zA-Z]{2,20}$/)) return res.status(400).send({ status: false, message: `Firstname should only contain alphabet` });

        //lname
        if (!validator.isValid(lname)) return res.status(400).send({ status: false, message: `lname is required ` });
        if (!lname.trim().match(/^[a-zA-Z]{2,20}$/)) return res.status(400).send({ status: false, message: `lname should only contain alphabet ` });

        //email
        if (!validator.isValid(email)) return res.status(400).send({ status: false, message: `Email is required` })
        email = email.trim().toLowerCase()
        if (!validator.isValidEmail(email)) return res.status(400).send({ status: false, message: `Email should be a valid email address ` })
        const isEmailAlreadyUsed = await userModel.findOne({ email });
        if (isEmailAlreadyUsed) return res.status(400).send({ status: false, message: `${email} email address is already registered` })

        //profileImage
        if (!files || (files && files.length === 0)) return res.status(400).send({ status: false, message: 'Profile image is required' })
        const profilePicture = await aws.uploadFile(files[0], "user")

        //phone
        if (!validator.isValid(phone)) return res.status(400).send({ status: false, message: 'phone no is required' });
        phone=phone.trim()
        if(phone.length!=10)return res.status(400).send({ status: false, message: `${phone.length} is not valid phone number length` })
        if (!phone.match(phoneRex)) return res.status(400).send({ status: false, message: `Please fill Indian phone number` })
        const isPhoneAlreadyUsed = await userModel.findOne({ phone });
        if (isPhoneAlreadyUsed) return res.status(400).send({ status: false, message: `${phone} phone number is already registered` })

        //password
        if (!validator.isValid(password)) return res.status(400).send({ status: false, message: `Password is required` })
        if (!validator.isValidPassword(password)) return res.status(400).send({ status: false, message: `Password must between 8-5 and contain a Capital,Symbol,Numeric` })

        //address
        if (!validator.isValid(address))
            return res.status(400).json({ status: false, msg: "Address is required" });
        // address=JSON.parse(address) 
        if (typeof address != "object") return res.status(400).json({ status: false, msg: "Please provide Address in Object" });

        if (address) {
            if (address.shipping) {
                if (!validator.isValid(address.shipping.street)) return res.status(400).send({ status: false, Message: "Shipping Street is required" })

                if (!validator.isValid(address.shipping.city)) return res.status(400).send({ status: false, Message: "Shipping city is required" })

                if (!validator.isValid(address.shipping.pincode)) return res.status(400).send({ status: false, Message: "Shipping pincode is required" })

                if (!/^[1-9][0-9]{5}$/.test(address.shipping.pincode)) return res.status(400).send({ status: false, message: "Shipping Pincode should in six digit Number" })
            } else {
                return res.status(400).send({ status: false, message: "please provide shipping address" })
            }

            if (address.billing) {
                if (!validator.isValid(address.billing.street)) return res.status(400).send({ status: false, Message: "Billing street is required" })

                if (!validator.isValid(address.billing.city)) return res.status(400).send({ status: false, Message: "Billing city is required" })

                if (!validator.isValid(address.billing.pincode)) return res.status(400).send({ status: false, Message: "Billing pincode is required" })

                if (!/^[1-9][0-9]{5}$/.test(address.billing.pincode)) return res.status(400).send({ status: false, message: "Billing pincode is invalid", })
            } else {
                return res.status(400).send({ status: false, message: "please provide billing address" })
            }
        }

        // ---------------------------------Validation ends-------------------------------
        //generating salt
        const salt = await bcrypt.genSalt(10)
        //hashing
        const hashedPassword = await bcrypt.hash(password, salt)
        //response structure
        const userData = {
            fname: fname,
            lname: lname,
            profileImage: profilePicture,
            email: email,
            phone,
            password: hashedPassword,
            address: address,
        }

        const newUser = await userModel.create(userData);
        return res.status(201).send({ status: true, message: ` User created successfully`, data: newUser });
    } catch (error) {
        return res.status(500).send({ status: false, message: error.message });
    }
}


const loginUser = async function (req, res) {
    try {
        let loginData = req.body
        let { email, password } = loginData

        //validation
        if (!validator.isValidBody(loginData)) return res.status(400).send({ status: false, message: "Please fill email or password" })
        let empStr = ""
        if (!validator.isValidEmail(email)) empStr = empStr + "Email "
        if (!validator.isValidPassword(password)) empStr = empStr + "Password"
        if (!validator.isValidEmail(email) || !validator.isValidPassword(password)) {
            return res.status(400).send({ status: false, message: `Please fill valid or mandatory ${empStr}` })
        }

        let user = await userModel.findOne({ email: email });
        if (!user) {

            return res.status(404).send({ status: false, message: "Email Not found" });
       
        }
        //comparing hard-coded password to the hashed password
        const validPassword = await bcrypt.compare(password, user.password)
        if (!validPassword) {
            return res.status(400).send({ status: false, message: "wrong password" })
        }

        let iat = Date.now()
        let exp = (iat) + (60 * 60 * 60 * 1000)
        //token credentials
        let token = jwt.sign(
            {
                userId: user._id.toString(),
                iat: iat,
                exp: exp
            },
            "project/booksManagementGroup51"// => secret key
        );

        //   res.status(200).setHeader("x-api-key", token);
        return res.status(200).send({ status: true, message: "Success", data: { userId: user._id, token: token } })
    } catch (err) {
        return res.status(500).send({ status: false, message: err.message })
    }
}


const getUserById = async (req, res) => {
    try {
        const userId = req.params.userId
        if (!mongoose.isValidObjectId(userId)) return res.status(400).send({ status: false, message: `Invalid userId in params` })
        const user = await userModel.findOne({ _id: userId })
        if (!user) return res.status(404).send({ status: false, message: "UserId Not found" })

        if (req.tokenData.userId != userId) return res.status(403).send({ status: false, message: "unauthorized access" })

        return res.status(200).send({ status: true, message: 'User profile details', data: user })
    } catch (error) {
        return res.status(500).send({ status: false, message: error.message })
    }
}


let updateUser = async (req, res) => {
    try {
        let userId = req.params.userId
        if (!mongoose.isValidObjectId(userId)) return res.status(400).send({ status: false, message: "Invalid userId in params" })
        const checkUserId = await userModel.findOne({ _id: userId })
        if (!checkUserId) return res.status(404).send({ status: false, message: "user not found" })
        //authorization
        if (userId != req.tokenData.userId)return res.status(400).send({ status: false, message: "Authorisation Failed--> you are not allowed to modify another acoount" })
        
        let data = req.body
        let files = req.files;
        let objectUpdate = {...data,...files}
        if (!validator.isValidBody(objectUpdate) ) return res.status(400).send({ status: false, message: "Please provide something to update" })
        if (data.fname || data.fname === "") {
            data.fname = data.fname.trim()
            if (!validator.isValid(data.fname)) return res.status(400).send({ status: false, message: "fname is empty" })
            objectUpdate.fname = data.fname
        }
        if (data.lname || data.lname === "") {
            data.lname = data.lname.trim()
            if (!validator.isValid(data.lname)) return res.status(400).send({ status: false, message: "lname is empty" })
            objectUpdate.lname = data.lname
        }
        if (data.email || data.email === "") {
            data.email = data.email.trim()
            if (!validator.isValid(data.email)) return res.status(400).send({ status: false, message: "email is empty" })
            let findEmail = await userModel.findOne({ email: data.email })
            if (findEmail._id!=userId) return res.status(400).send({ status: false, message: "email is already exists please enter a new emailId " })
            if (validator.isValidEmail(data.email) == false) return res.status(400).send({ status: false, message: "You entered a Invalid email" })
            objectUpdate.email = data.email
        }
        if (data.profileImage) {
            if (!files || (files && files.length === 0)) return res.status(400).send({ status: false, message: 'Profile image is empty' })
            const profilePicture = await aws.uploadFile(files[0])
            objectUpdate.profileImage = profilePicture
        }

        if (data.phone || data.phone === "") {
            data.phone = data.phone.trim()
            if (!validator.isValid(data.phone)) return res.status(400).send({ status: false, message: "phone is empty" })
            let findPhone = await userModel.findOne({ phone: data.phone })
            if (phoneRex.test(data.phone) == false) return res.status(400).send({ status: false, message: "You entered a Invalid phone number" })
            if (findPhone) return res.status(400).send({ status: false, message: "This phone number is already exists" })
            objectUpdate.phone = data.phone
        }
        if (data.password || data.password === "") {
            data.password = data.password.trim()
            if (!validator.isValid(data.password)) return res.status(400).send({ status: false, message: "password is empty" })
            if (!validator.isValidPassword(data.password)) return res.status(400).send({ status: false, message: `Password must between 8-5 and contain a Capital,Symbol,Numeric` })
            const salt = await bcrypt.genSalt(10)
            const hashedPassword = await bcrypt.hash(data.password, salt)
            objectUpdate.password = hashedPassword
        }

        if (data.address) {
            let { shipping, billing } = data.address
            let findAddres=await userModel.findOne({_id:userId})
            objectUpdate.address=findAddres.address
            if (shipping) {
                if (shipping.street || shipping.street === "") {
                    shipping.street = shipping.street.trim()
                    if (!validator.isValid(shipping.street)) return res.status(400).send({ status: false, message: "shipping street is empty" })
                    objectUpdate.address.shipping.street=shipping.street
                }
                if (shipping.city || shipping.city === "") {
                    shipping.city = shipping.city.trim()
                    if (!validator.isValid(shipping.city)) return res.status(400).send({ status: false, message: "shipping city is empty" })
                    objectUpdate.address.shipping.city=shipping.city
                }
                if (shipping.pincode || shipping.pincode === "") {
                    shipping.pincode = shipping.pincode.trim()
                    if (!validator.isValid(shipping.pincode)) return res.status(400).send({ status: false, message: "shipping pincode is empty" })
                    if (!/^[1-9][0-9]{5}$/.test(shipping.pincode)) return res.status(400).send({ status: false, message: "Shipping Pincode should in six digit Number" })
                    objectUpdate.address.shipping.pincode=shipping.pincode
                }
            }
            if (billing) {
                if (billing.street || billing.street === "") {
                    billing.street = billing.street.trim()
                    if (!validator.isValid(billing.street)) return res.status(400).send({ status: false, message: "billing street is empty" })
                    objectUpdate.address.billing.street=billing.street
                }
                if (billing.city || billing.city === "") {
                    billing.city = billing.city.trim()
                    if (!validator.isValid(billing.city)) return res.status(400).send({ status: false, message: "billing city is empty" })
                    objectUpdate.address.billing.city=billing.city
                }
                if (billing.pincode || billing.pincode === "") {
                    billing.pincode = billing.pincode.trim()
                    if (!validator.isValid(billing.pincode)) return res.status(400).send({ status: false, message: "billing pincode is empty" })
                    if (!/^[1-9][0-9]{5}$/.test(billing.pincode)) return res.status(400).send({ status: false, message: "billing Pincode should in six digit Number" })
                    objectUpdate.address.billing.pincode=billing.pincode
                }
            }
        }
        let updateData = await userModel.findOneAndUpdate({ _id: userId }, { $set: objectUpdate, updatedAt: Date.now() }, { new: true })

        return res.status(200).send({ status: true, message: "Data is updated successfully", data: updateData })

    } catch (error) {
        return res.status(500).send({ status: false, message: error.message })
    }
}

module.exports = { createUser, getUserById, loginUser, updateUser }