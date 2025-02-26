import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createCompetitionRecord from '@salesforce/apex/VisitController.createCompetitionRecord';

export default class CompetitionForm extends LightningElement {
    @api distributorName;
    @track hasUploadedImage = false;
    @track imageUrl;
    @track formData = {
        competitorName: '',
        productCategory: '',
        displayBoard: '',
        product: '',
        specialOffers: '',
        specialOfferDetails: '',
        competitorProductImage: '' // Store ContentDocumentId
    };

    
    get formattedDate() {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        return `${day}-${month}-${year}`;
    }

    displayBoardOptions = [
        { label: 'Choose'},
        { label: 'Yes', value: 'Yes' },
        { label: 'No', value: 'No' }
    ];

    specialOffersOptions = [
        { label: 'Choose'},
        { label: 'Yes', value: 'Yes' },
        { label: 'No', value: 'No' }
    ];

    handleInputChange(event) {
        const { name, value } = event.target;
        this.formData = { ...this.formData, [name]: value };
    }

    handleUploadFinished(event) {
        const uploadedFiles = event.detail.files;
        if (uploadedFiles.length > 0) {
            this.formData.competitorProductImage = uploadedFiles[0].documentId;
            this.imageUrl = `/sfc/servlet.shepherd/version/download/${uploadedFiles[0].contentVersionId}`;
            this.hasUploadedImage = true;
            
            this.showToast(
                'Success',
                'Image uploaded successfully',
                'success'
            );
        }
    }
    handleCancelImage() {
        this.formData.competitorProductImage = '';
        this.imageUrl = null;
        this.hasUploadedImage = false;
    }
    validateForm() {
        let isValid = true;
        let inputFields = this.template.querySelectorAll('.form-control');
        
        inputFields.forEach(field => {
            if (field.hasAttribute('required') && !field.value) {
                isValid = false;
                field.classList.add('error');
            } else {
                field.classList.remove('error');
            }
        });
        
        return isValid;
    }
    handleCancel() {
        this.clearFields();
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    handleSave() {
        
        if (!this.validateForm()) {
            this.showToast('Error', 'Please fill in all required fields', 'error');
            return;
        }
        createCompetitionRecord({
            competitorName: this.formData.competitorName,
            productCategory: this.formData.productCategory,
            displayBoard: this.formData.displayBoard,
            product: this.formData.product,
            specialOffers: this.formData.specialOffers,
            specialOfferDetails: this.formData.specialOfferDetails,
            competitorProductImage: this.formData.competitorProductImage
        })
            .then(() => {
                this.showToast('Success', 'Competition record created successfully', 'success');
                this.clearFields();
                this.dispatchEvent(new CustomEvent('cancel'));
            })
            .catch(error => {
                this.showToast('Error', error.body.message, 'error');
            });
    }

    clearFields() {
        this.template.querySelectorAll('lightning-input, lightning-combobox, lightning-textarea').forEach(field => {
            field.value = null;
        });
        this.handleCancelImage(); // Also clear image state

    }
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}