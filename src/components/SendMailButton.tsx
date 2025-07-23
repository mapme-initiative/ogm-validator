import {Button} from "@mui/material";
import SendIcon from '@mui/icons-material/Send';

type SendMailButtonProps = {
    isEnabled: boolean;
}

export default function SendMailButton(props: SendMailButtonProps) {
    const generateMailTo = () => {
        const subject = encodeURIComponent("Validated Location data for Project <<enter INPRO Numbers, commasepearted>>");
        const body = encodeURIComponent("Dear sir or madam, \n\rThis email contains validated location data for the project(s) <<enter INPRO Numbers, commasepearted>>. It was validated by the \"Location Validator\" on https://mapme-initiative.github.io/ogm-validator/. You can use the Location Validator Tool (https://mapme-initiative.github.io/ogm-validator/) yourself to check the data validity and see all project locations printed on a map. Yours sincerly, ");
        const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
        window.location.href = mailtoLink;
    }
    return (
        <Button variant="contained"
                disabled={!props.isEnabled}
                endIcon={<SendIcon/>} sx={{ml: 2}}
                onClick={generateMailTo} >
            Send Email
        </Button>
    )
}