import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createPaymentFollowup from '@salesforce/apex/VisitController.createPaymentFollowup';

export default class PaymentFollowup extends LightningElement {
    @api distributorName;
    @api accountId;
    
    expectedAmount;
    expectedPaymentDate;
    comments;

    get formattedDate() {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        return `${day}-${month}-${year}`;
    }

    get minDate() {
        return new Date().toISOString().split('T')[0];
    }

    handleAmountChange(event) {
        const value = event.target.value;
        // Check if the value is zero or negative
        if (value <= 0) {
            this.showToast('Error', 'Amount must be greater than zero', 'error');
            event.target.value = ''; // Clear the input
            this.expectedAmount = null;
            return;
        }
        this.expectedAmount = value;
    }

    handleDateChange(event) {
        const selectedDate = event.target.value;
        if (selectedDate < this.minDate) {
            this.showToast('Error', 'Please select today or a future date', 'error');
            event.target.value = this.minDate;
            return;
        }
        this.expectedPaymentDate = selectedDate;
    }

    handleCommentsChange(event) {
        this.comments = event.target.value;
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    handleSave() {
        if (!this.expectedAmount || !this.expectedPaymentDate || !this.comments) {
            this.showToast('Error', 'Please fill in all required fields', 'error');
            return;
        }

        createPaymentFollowup({
            accountId: this.accountId,
            expectedAmount: this.expectedAmount,
            expectedPaymentDate: this.expectedPaymentDate,
            comments: this.comments
        })
        .then(() => {
            this.showToast('Success', 'Payment followup created successfully', 'success');
            this.dispatchEvent(new CustomEvent('save'));
        })
        .catch(error => {
            this.showToast('Error', error.body.message, 'error');
        });
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