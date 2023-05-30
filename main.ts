/* --- ENUMS --- */
enum DataKey{
    a, b, c, d, e, f, g, h, i, j, k, l, m, o, p, q, r, s, t, u, v, w, x, y, z
}
// without n as that is special
const alphabetDataKeys = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]

/**
 * Extension providing blocks for sending data to cloudlet for ML.
 */
//% color="#AA278D" weight=100
namespace cloudlet {

    const deviceID = control.deviceSerialNumber().toString();

    /* ---  Radio Receiver --- */
    class RadioReceiver {
        private static singletonRadioReceiver : RadioReceiver;
        static getRadioReceiver() {
            if (!RadioReceiver.singletonRadioReceiver) {
                RadioReceiver.singletonRadioReceiver = new RadioReceiver();
            }
            return RadioReceiver.singletonRadioReceiver;
        }

        private onHandshake: (hsID: string) => void;
        private onIdent: (id: string) => void;

        private constructor() {}

        initialise(onIdent?: (id:string)=>void, onHandshake?: (hsID: string)=>void) {
            if (onHandshake)
                this.onHandshake = onHandshake;
            else
                this.onHandshake = (hsID: string)=>null;

            if (onIdent)
                this.onIdent = onIdent;
            else
                this.onIdent = (id: string)=>null;

            radio.onReceivedString((s) => {
                let start = s.substr(0,2)
                if (start === "HS" || start === "ID") {
                    let splt = s.split(",");
                    if (splt[0].substr(2) === deviceID) {
                        if (start === "HS") this.onHandshake(splt[1].trim())
                        else this.onIdent(splt[1].trim())
                    }
                }
            })
        }

        setOnHandshake(onHandshake: (hsID: string)=>void) {
            this.onHandshake = onHandshake;
        }

        setOnIdent(onIdent: (id: string)=>void) {
            this.onIdent = onIdent;
        }
    }

    export interface DataPoint {
        [key: string]: number
    }

    class Controller {
        private static singletonController: Controller;
        static getController() {
            if (!Controller.singletonController)
                Controller.singletonController = new Controller();
            return Controller.singletonController;
        }

        private radioReceiver: RadioReceiver;
        private keys: string[];
        private dataSender: (n:number) => void;
        private seqNum: number;
        private hsID: string;

        private onIdent = (id: string) => {
            let startTime = input.runningTime()
            while (input.runningTime()-startTime < 2000)
                basic.showString(id);
            basic.clearScreen();
        }

        private constructor() {
            this.radioReceiver = RadioReceiver.getRadioReceiver();
            this.radioReceiver.initialise(this.onIdent)
        }

        private sendHandshake(recordID: string) {
            let message = "HS" + deviceID + ","  + recordID;
            radio.sendString(message);
        }

        private sendClass(classification: number | undefined) {
            radio.sendString(this.hsID + "cl:" + classification.toString());
        }

        private sendJSON(json: string) {
            let seq = this.seqNum;
            let message = json;
            while (message.length > 0) {
                let maxLen = 15 - seq.toString().length;
                let toSend = message.substr(0, maxLen);
                message = message.substr(maxLen);
                radio.sendString(this.hsID + seq.toString() + "," + toSend);
                seq++;
            }
            this.seqNum = seq;
        }

        private sendTerminate() {
            radio.sendString(this.hsID + this.seqNum.toString() + ",;");
        }

        setOnIdent(onIdent: (id: string)=>void) {
            this.radioReceiver.setOnIdent(onIdent);
        }

        setKeys(keys: DataKey[]) {
            this.keys = keys.map((k) => alphabetDataKeys[k as number]);
        }

        setDataSender(dataSender: (n: number)=>void) {
            this.dataSender = dataSender;
        }

        generateDataPoint(val1: number, val2: number|undefined, val3: number|undefined, val4:number|undefined) {
            let dp:DataPoint = {}
            const vals = [val1, val2, val3, val4]
            this.keys.forEach((k, i) => {
                dp[k] = vals[i];
            })
            return dp;
        }

        sendDataPoint(n:number, dp: DataPoint) {
            dp["n"] = n;
            const dpAsStr = JSON.stringify(dp);
            this.sendJSON(dpAsStr);
        }

        sendStream(duration: number, classification: number) {
            this.radioReceiver.setOnHandshake((hsID: string) => {
                this.hsID = hsID;
                this.sendClass(classification);

                const pauseLen = 5;
                let startTime = input.runningTime();
                let tally = 0;
                this.seqNum = 0;

                while (input.runningTime() - startTime < (duration*1000)) {
                    tally++;
                    this.dataSender(tally);
                    pause(pauseLen);
                }

                this.sendTerminate();
            });

            const recordID = input.runningTime();
            this.sendHandshake(recordID.toString())
        }
    }

    /* --- BLOCKS --- */
    //% block="setup this micro:bit for cloudlet"
    export function initialise() {
        radio.setGroup(33);
        Controller.getController();
    }

    //% draggableParameters="reporter"
    //% block="on ident use $id"
    //% advanced="true"
    export function onIdentReplacement(handler: (id:string)=>void) {
        const controller = Controller.getController();
        controller.setOnIdent(handler);
    }

    //% block="set data structure keys: $key1||$key2 $key3 $key4"
    //% expandableArgumentMode="enabled"
    //% key1.defl=DataKey.a
    //% key2.defl=DataKey.b
    //% key3.defl=DataKey.c
    //% key4.defl=DataKey.d
    //% advanced="true"
    export function setDataStructure(key1: DataKey, key2?: DataKey, key3?:DataKey, key4?:DataKey) {
        const controller = Controller.getController();
        let keys = []
        keys.push(key1);
        if (key2) keys.push(key2);
        if (key3) keys.push(key3);
        if (key4) keys.push(key4);
        controller.setKeys(keys);
    }

    //% block="dp with values $val1||$val2$val3$val4"
    //% expandableArgumentMode="enabled"
    //% advanced="true"
    export function createDataPoint(val1: number, val2?:number, val3?:number, val4?:number): DataPoint {
        const controller = Controller.getController();
        return controller.generateDataPoint(val1,val2,val3,val4);
    }

    //% block="send data point $n $dataPoint"
    //% advanced="true"
    export function sendDataPoint(n: number, dataPoint: DataPoint){
        const controller = Controller.getController();
        controller.sendDataPoint(n, dataPoint);
    }

    //% block="to send custom data point $n"
    //% draggableParameters="reporter"
    //% advanced="true"
    export function onSendDataPoint(dataSender: (n: number) => void) {
        const controller = Controller.getController();
        controller.setDataSender(dataSender);
    }

    //% block="send data stream for $duration s of class num $classification"
    //% duration.min=1 duration.max=5 duration.defl=2
    export function sendDataStream(duration: number, classification: number) {
        const controller = Controller.getController();
        controller.sendStream(duration, classification);
    }

}