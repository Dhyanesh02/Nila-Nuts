import { LightningElement, api } from 'lwc';
import getOutstandingDetails from '@salesforce/apex/VisitController.getOutstandingDetails';
import { NavigationMixin } from 'lightning/navigation';
import getInvoiceRecordId from '@salesforce/apex/VisitController.getInvoiceRecordId';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createPayment from '@salesforce/apex/VisitController.createPayment';

export default class OutstandingDetails extends NavigationMixin(LightningElement) {
    @api distributorName;
    @api
    get formattedDate() {
        if (!this._formattedDate) {
            // Set default to today if no date provided
            const today = new Date();
            this._formattedDate = this.formatDate(today);
        }
        return this._formattedDate;
    }
    
    set formattedDate(value) {
        if (value) {
            this._formattedDate = this.formatDate(new Date(value));
        } else {
            // Set default to today if value is null/undefined
            const today = new Date();
            this._formattedDate = this.formatDate(today);
        }
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
    }
    
    totalOutstanding;
    outstandingRecords = [];
    error;
    showPaymentModal = false;
    paymentAmount;
    paymentMode;
    transactionId;
    selectedInvoiceNumber;
    cardNumber;
    cardType;
    cvv;
    expirationDate;

    async handleInvoiceClick(event) {
        event.preventDefault();
        const voucherNumber = event.currentTarget.dataset.id;
        
        try {
            // Get Invoice Record Id from Apex
            const invoiceId = await getInvoiceRecordId({ voucherNumber: voucherNumber });
            
            // Navigate to the invoice record
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: invoiceId,
                    objectApiName: 'Invoice__c',
                    actionName: 'view'
                }
            });
        } catch (error) {
            console.error('Error navigating to invoice:', error);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Unable to find invoice record.',
                    variant: 'error'
                })
            );
        }
    }
    connectedCallback() {
        console.log('Distributor Name:', this.distributorName);
        console.log('Formatted Date:', this.formattedDate);
        
        if (this.distributorName) {
            this.loadOutstandingDetails();
        }
    }

    async loadOutstandingDetails() {
        try {
            console.log('Loading details for distributor:', this.distributorName);
            const result = await getOutstandingDetails({ distributorName: this.distributorName });
            console.log('Data received:', result);
            
            // Create a new array with processed records
            if (result && result.outstandingRecords) {
                const processedRecords = result.outstandingRecords.map(record => {
                    return {
                        ...record,
                        dueDateClass: this.isOverdue(record.dueDate) ? 'overdue-date' : 'normal-date'
                    };
                });
                
                // Assign the processed records to the tracked property
                this.outstandingRecords = processedRecords;
                this.totalOutstanding = result.totalOutstanding;
            } else {
                this.outstandingRecords = [];
                this.totalOutstanding = 0;
            }
            
            this.error = undefined;
        } catch (error) {
            console.error('Error loading data:', error);
            this.error = error.message;
            this.outstandingRecords = [];
            this.totalOutstanding = 0;
        }
    }

    handleGoBack() {
        // Dispatch the cancel event that the parent component is listening for
        const cancelEvent = new CustomEvent('cancel', {
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(cancelEvent);
        console.log('Cancel event dispatched');
    }

    // Getter for checking if we have records
    get hasRecords() {
        return this.outstandingRecords && this.outstandingRecords.length > 0;
    }

    get paymentModeOptions() {
        return [
            { label: 'Cash', value: 'Cash' },
            { label: 'Card', value: 'Card' },
            { label: 'Online Transfer', value: 'Online Transfer' }
        ];
    }

    get showTransactionField() {
        return this.paymentMode === 'Online Transfer';
    }

    get cardTypeOptions() {
        return [
            { label: 'Visa', value: 'Visa' },
            { label: 'MasterCard', value: 'MasterCard' },
            { label: 'American Express', value: 'American Express' },
            { label: 'Discover', value: 'Discover' }
        ];
    }

    get showCardFields() {
        return this.paymentMode === 'Card';
    }

    openPaymentModal(event) {
        this.selectedInvoiceNumber = event.target.dataset.invoice;
        this.paymentAmount = '';
        this.paymentMode = '';
        this.transactionId = '';
        this.showPaymentModal = true;
    }

    closePaymentModal() {
        this.showPaymentModal = false;
        this.resetFields();
    }

    handleAmountChange(event) {
        this.paymentAmount = event.target.value;
    }

    handlePaymentModeChange(event) {
        this.paymentMode = event.target.value;
    }

    handleTransactionIdChange(event) {
        this.transactionId = event.target.value;
    }

    handleCardNumberChange(event) {
        this.cardNumber = event.target.value;
    }

    handleCardTypeChange(event) {
        this.cardType = event.target.value;
    }

    handleCvvChange(event) {
        this.cvv = event.target.value;
    }

    handleExpirationDateChange(event) {
        this.expirationDate = event.target.value;
    }

    resetFields() {
        this.paymentAmount = null;
        this.paymentMode = null;
        this.transactionId = null;
        this.selectedInvoiceNumber = null;
        this.cardNumber = null;
        this.cardType = null;
        this.cvv = null;
        this.expirationDate = null;
    }

    async handlePaymentSave() {
        if (!this.validateFields()) {
            return;
        }

        try {
            await createPayment({
                invoiceNumber: this.selectedInvoiceNumber,
                amount: this.paymentAmount,
                paymentMode: this.paymentMode,
                transactionId: this.transactionId,
                cardNumber: this.paymentMode === 'Card' ? this.cardNumber : null,
                cardType: this.paymentMode === 'Card' ? this.cardType : null,
                cvv: this.paymentMode === 'Card' ? this.cvv : null,
                expirationDate: this.paymentMode === 'Card' ? this.expirationDate : null
            });

            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Payment created successfully',
                    variant: 'success'
                })
            );

            this.closePaymentModal();
            this.refreshData();
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body.message,
                    variant: 'error'
                })
            );
        }
    }

    validateFields() {
        if (!this.paymentAmount || !this.paymentMode) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Please fill all required fields',
                    variant: 'error'
                })
            );
            return false;
        }

        if (this.paymentMode === 'Online Transfer' && !this.transactionId) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Transaction ID is required for Online Transfer',
                    variant: 'error'
                })
            );
            return false;
        }

        if (this.paymentMode === 'Card') {
            if (!this.cardNumber || !this.cardType || !this.cvv || !this.expirationDate) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: 'Please fill all card details',
                        variant: 'error'
                    })
                );
                return false;
            }
            
            // Validate card number length
            if (this.cardNumber.length !== 16) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: 'Card number must be 16 digits',
                        variant: 'error'
                    })
                );
                return false;
            }

            // Validate CVV length
            if (this.cvv.length !== 3) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: 'CVV must be 3 digits',
                        variant: 'error'
                    })
                );
                return false;
            }

            // Validate expiration date is not in the past
            const today = new Date();
            const expDate = new Date(this.expirationDate);
            if (expDate < today) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: 'Card has expired',
                        variant: 'error'
                    })
                );
                return false;
            }
        }

        return true;
    }

    isOverdue(dueDate) {
        if (!dueDate) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time part for accurate date comparison
        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);
        return due < today;
    }
}