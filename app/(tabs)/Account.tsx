import { Ionicons} from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { 
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword as firebaseUpdatePassword,
    updateEmail,
    signOut } from "firebase/auth";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { auth, db } from "../../lib/firebase";


import { User,updateUserName,updateUserEmail, saveUserPlatforms } from "../../modules/user";
import{ Boxes} from "../../components/boxes"
import { Typography } from "../../components/Typography";



const GAP = 16;
const PAGE_PAD = 16;


type Platform = {
        id: string;
        platform: string;
}






export default function Account(){

    const router = useRouter();
    const [busy,setBusy]=useState(false);
    const[platformLoading,setPlatformLoading]=useState(false);
    const [userName, setUserName]=useState("");
    const [email, setEmail]=useState("");
    const [password, setPassword]=useState("");
    const[currentPassword,setCurrentPassword]=useState("");
    const [confirmPassword, setConfirmPassword]=useState("");
    const [ownedPlatforms, setOwnedPlatforms]=useState<Platform[]>([]);
    const [display,setDisplay]=useState(true);
    const [edit,setEdit]=useState(false);
    const[edit2,setEdit2]=useState(false);

    const platforms = [
    "Playstation 5",
    "Playstation 4",
    "Xbox Series X-S",
    "Nintendo Switch",
    "Mobile",
    "PC"
    ]
    const [tempOwnedPlatforms, setTempOwnedPlatforms]=useState<string[]>([]);


    const reauthenticate = async(password:string) => {
        const user = auth.currentUser;
        if (!user) {
            console.error("No user is signed in");
            return;
        }
        const credential = EmailAuthProvider.credential( user.email!, password);
        await reauthenticateWithCredential(user, credential);
    }

    const onSelectedPlatform = (platform: string) => {
        setTempOwnedPlatforms(prev => 
            prev.includes(platform)
            ?prev.filter(p => p !== platform)
            :[...prev, platform])
        console.log(tempOwnedPlatforms);
    }
    

    const getUserData = async () => {
        setPlatformLoading(true);
        const user = auth.currentUser;
            if (!user) {
                console.error("No user is signed in");
                return;
            }

            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as User;
                setUserName(data.username);
                
                setEmail(data.email);
            } else {
            console.log("No such document!");
            }
            const q = query(collection(db, "users", user.uid, "platforms"));
            const snap = await getDocs(q);
            const data: Platform[] = snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<Platform, "id">),
                
            }));
        setOwnedPlatforms(data);
        setPlatformLoading(false);
        // console.info(ownedPlatforms)
    };

    useEffect(() => {
    getUserData();
    }, []);



    const onEditPressed = () => {
        setDisplay(false);
        setEdit(true);
        
    }

    const onCancelPressed = () => {
        setDisplay(true);
        setEdit(false);
        setEdit2(false);
        setTempOwnedPlatforms([]);
    }

    useEffect(() => {
        if(edit){
            setTempOwnedPlatforms(ownedPlatforms.map(p => p.platform));
        }}, [edit]);


    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.replace("/"); // navigate back to login
        } catch (e) {
            console.error("Error signing out:", e);
        }
    };
    
    const onSavePressed = async () => {
        setBusy(true);
        const user = auth.currentUser;
        if (!user) {
            console.error("No user is signed in");
            setBusy(false);
            return;
        }
        
        try{
            if(email !== user.email){
                await updateEmail(user, email);
            }
            await updateUserName(user.uid, userName);
            await updateUserEmail(user.uid, email);
        
            await saveUserPlatforms(user.uid, tempOwnedPlatforms, ownedPlatforms.map(p => p.platform));
            setOwnedPlatforms(tempOwnedPlatforms.map(platform => ({id: platform.toLowerCase().replace(/\s+/g, '-'), platform})));

            if(edit2){
                if(password.length <6){
                    alert("Password should be at least 6 characters long");
                    setBusy(false);
                    return;
                }
                if(password !== confirmPassword){
                    alert("Passwords do not match");
                    setBusy(false);
                    return;
                }
                await reauthenticate(currentPassword);

                await firebaseUpdatePassword(user, password);

                setCurrentPassword("");
                setPassword("");
                setConfirmPassword("");
                setEdit2(false);
            }
            setDisplay(true);
            setEdit(false);
            setTempOwnedPlatforms([]);
        } catch (err: any){
        if (err.code === "auth/wrong-password") {
            alert("Current password is incorrect");
        } else if (err.code === "auth/requires-recent-login") {
            alert("Please log in again to change your password");
        } else {
            alert("Failed to update: " + err.message);
        }
        }
        setBusy(false);


    }

    return(
        <ScrollView style={styles.screen}>
            <View style={styles.topBar}>
                <Text style={styles.heading}>Account</Text>
            </View>
            <View style={Boxes.formBox2}>
                <View style={styles.titleBar}>
                    <Text style={Typography.h4}>Profile</Text>
                    <Pressable onPress={onEditPressed}>
                        <Text style={Typography.link2}>Edit</Text>
                    </Pressable>
                </View>
                <View style={styles.iconText}>
                    <Ionicons name="person-outline" size={18} color="white" />
                    <Text style={Typography.subtitle}>Username</Text>
                </View>
                {display &&(
                    <Text style={[Typography.body, Boxes.textImputBox]}>{userName}</Text>
                )}
                {edit &&(
                    <TextInput
                    value={userName}
                    onChangeText={setUserName}
                    style={[Typography.body, Boxes.textImputBox]}/>
                )}
                <View style={styles.iconText}>
                    <Ionicons name="mail-outline" size={18} color="white" />
                    <Text style={Typography.subtitle}>Email</Text>
                </View>
                {display &&(
                    <Text style={[Typography.body, Boxes.textImputBox]}>{email}</Text>
                )}
                {edit && (
                    <TextInput
                    value={email}
                    onChangeText={setEmail}
                    style={[Typography.body, Boxes.textImputBox]}/>
                )}
                <View style={styles.iconText}>
                    <Ionicons name="game-controller-outline" size={18} color="white" />
                    <Text style={Typography.subtitle}>Owned Consoles</Text>
                </View>
                {display && !platformLoading &&(
                    <View style={[styles.iconText]}>
                {ownedPlatforms.map((ownedPlatform) => (
                    <View style={styles.option} key={ownedPlatform.platform}>
                        <Text style={[styles.metaSmall,styles.chip]}>{ownedPlatform.platform}</Text>
                    </View>
                ))}
                </View>
                )}
                {edit &&(
                    <>
                        <View style={[{ gap: 8}]}>
                            {platforms.map((platform)=>(
                                <View style={styles.option} key={platform}>
                                <Pressable style={[Boxes.checkBox, {backgroundColor: tempOwnedPlatforms.includes( platform) ? "#3997fbff" : "#000000"}]} onPress={() => onSelectedPlatform(platform)}/>
                                <Text style={Typography.body}>{platform}</Text>
                                </View>
                            ))}
                        </View>
                        <Text style={Typography.link} onPress={() => setEdit2(true)}>
                            Update Password
                        </Text>
                        {edit2 &&(
                            <>
                            <TextInput
                            placeholder="Current Password"
                            secureTextEntry
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            style={[Boxes.textImputBox, Typography.placeholder]}
                            />
                            <TextInput
                            placeholder="New Password"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                            style={[Boxes.textImputBox, Typography.placeholder]}
                            />
                            <TextInput
                            placeholder="Confirm New Password"
                            secureTextEntry
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            style={[Boxes.textImputBox, Typography.placeholder]}
                            />
                            </>
                        )}
                        <Pressable
                            onPress={onSavePressed}
                            
                            disabled={busy}
                            accessibilityRole="button"
                            style={[Boxes.button, {opacity: busy ? 0.6 : 1}]}>
                            <Text style={[Typography.h4, { color: "#FFFFFF"}]}>{busy ? "Please wait…" : "Save Changes"}</Text>
                        </Pressable>
                        <Pressable
                            onPress={onCancelPressed}
                            disabled={busy}
                            accessibilityRole="button"
                            style={[Boxes.button2]}>
                            <Text style={[Typography.h4, { color: "#FFFFFF"}]}>{busy ? "Please wait…" : "Cancel"}</Text>
                        </Pressable>
                    </>
                )}
                
            </View>
            <View style={Boxes.formBox}>
                <View style={styles.iconButton}>
                    <Ionicons name="exit-outline" size={26} color="red" />
                    <Pressable onPress={handleSignOut}>
                        <Text style={[Typography.subtitle, {color: "red"}]}>Logout</Text>
                    </Pressable>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#0b1220",
        paddingTop: 40,
    },
    topBar: {
        paddingHorizontal: PAGE_PAD,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    heading: { color: "#F3F4F6", fontSize: 22, fontWeight: "800" },
    signOut: { color: "#60A5FA", fontSize: 14, fontWeight: "600" },
    iconText: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap" 
    }, 
    titleBar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    option: { flexDirection: "row", alignItems: "center", gap: 10},
    optionColumn: { flexDirection: "column", alignItems: "center", gap: 10 },
    metaSmall: {
    fontSize: 16,
    color: "#60A5fA",
    
    },

    chip: {
    backgroundColor: "#1F2937",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 6,          // full rounded pill shape
    paddingHorizontal: 10,
    paddingVertical: 4,
    },
    iconButton:{
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
});