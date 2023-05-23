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

    class Controller {
        private static singletonController: Controller;
        static getController() {
            if (!Controller.singletonController)
                Controller.singletonController = new Controller();
            return Controller.singletonController;
        }

        private radioReceiver: RadioReceiver;

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

        setOnHandshake(onHandshake: (hsID: string)=>void) {
            this.radioReceiver.setOnHandshake(onHandshake);
        }

        setOnIdent(onIdent: (id: string)=>void) {
            this.radioReceiver.setOnIdent(onIdent);
        }
    }

    /* --- BLOCKS --- */
    //% block="initialise cloudlet ml"
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

}