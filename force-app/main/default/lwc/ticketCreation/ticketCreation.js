import { LightningElement, api } from 'lwc';
import createTicketWithFile from '@salesforce/apex/VisitController.createTicketWithFile';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class TicketCreation extends LightningElement {
    @api distributorName;
    @api accountId;
    @api ticketDate;
    
    complaintTypes = [
        { label: 'Late Delivery', value: 'Late Delivery' },
        { label: 'Payment Related', value: 'Payment Related' },
        { label: 'Product Related', value: 'Product Related' },
        { label: 'Other', value: 'Other' }
    ];

    description = '';
    selectedComplaintType = '';
    fileData = null;
    imageUrl = '';

    get formattedDate() {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        return `${day}-${month}-${year}`;
    }

    handleDescriptionChange(event) {
        this.description = event.target.value;
    }

    handleComplaintTypeChange(event) {
        this.selectedComplaintType = event.target.value;
    }

    handleCaptureClick(event) {
        event.preventDefault();
        this.template.querySelectorAll('input[type="file"]')[1].click();
    }

    handleUploadClick(event) {
        event.preventDefault();
        this.template.querySelectorAll('input[type="file"]')[0].click();
    }

    handleFileChange(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                this.imageUrl = reader.result;
                this.fileData = {
                    filename: file.name || `image_${new Date().getTime()}.jpg`,
                    base64: reader.result.split(',')[1],
                    contentType: file.type
                };
            };
            reader.readAsDataURL(file);
        }
    }

    handleRemoveImage() {
        this.imageUrl = '';
        this.fileData = null;
    }

    handleSave() {
        if (!this.selectedComplaintType || !this.description) {
            this.showToast('Error', 'Please fill in all required fields', 'error');
            return;
        }

        createTicketWithFile({
            accountId: this.accountId,
            complaintType: this.selectedComplaintType,
            description: this.description,
            fileData: this.fileData ? JSON.stringify(this.fileData) : null
        })
        .then(() => {
            this.showToast('Success', 'Ticket created successfully', 'success');
            this.dispatchEvent(new CustomEvent('save'));
        })
        .catch(error => {
            this.showToast('Error', error.body.message, 'error');
        });
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
}