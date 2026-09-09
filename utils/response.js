export const successResponse = (res, message, data = {}, status = 200) => {

    return res.status(status).json({

        success: true,
        message,
        data,
         timestamp: new Date().toISOString()

    });

}


export const errorResponse = (res, status, message) => {

    return res.status(status).json({
        success: false,
        message,
         timestamp: new Date().toISOString()
    });

}