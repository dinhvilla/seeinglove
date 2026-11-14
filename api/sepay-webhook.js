import admin from 'firebase-admin';

// Khởi tạo Firebase Admin SDK tự động kết nối Cloud Firestore
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
        })
    });
}
const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const data = req.body;
        const content = data.content || ""; 
        const amount = data.transferAmount || 0;

        // Trích xuất mã định danh thành viên (Ví dụ: P333ML21-123 hoặc V333ML21-123)
        const matchCode = content.match(/[PV][0-9]{3}[BCDGHKLMNPQTUVY]{2}[0-9]{2}-[0-9]{3}/i);
        
        if (matchCode) {
            const memberCode = matchCode[0].toUpperCase();
            const userRef = db.collection("users").doc(memberCode);
            const userDoc = await userRef.get();

            if (userDoc.exists) {
                let userData = userDoc.data();
                
                // Nếu nội dung chuyển khoản có từ khóa HIDE hoặc VIP -> Kích hoạt gói ẩn hồ sơ hoặc Tinh hoa
                if (content.toUpperCase().includes("HIDE") || content.toUpperCase().includes("VIP") || content.toUpperCase().includes("TINHHOA")) {
                    let expDate = new Date();
                    expDate.setMonth(expDate.getMonth() + 1);
                    
                    await userRef.update({
                        isElite: true,
                        isHidden: content.toUpperCase().includes("HIDE"),
                        hideExpireAt: content.toUpperCase().includes("HIDE") ? expDate.toISOString() : null,
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    // Nếu là nạp Point (Quy đổi tự động: 1.000đ = 1 point)
                    const addedPoints = Math.round(amount / 1000);
                    const currentPoints = parseInt(userData.points) || 0;
                    
                    await userRef.update({
                        points: currentPoints + addedPoints,
                        updatedAt: new Date().toISOString()
                    });
                }
            }
        }

        return res.status(200).json({ success: true, message: "Webhook processed successfully" });
    } catch (error) {
        console.error("Webhook Error:", error);
        return res.status(500).json({ error: error.message });
    }
}