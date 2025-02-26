import { LightningElement, wire, track,api } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getVisits from '@salesforce/apex/VisitController.getVisits';
import uploadFile from '@salesforce/apex/VisitController.uploadFile';
import updateVisitCheckin from '@salesforce/apex/VisitController.updateVisitCheckin';
import updateVisitCheckout from '@salesforce/apex/VisitController.updateVisitCheckout';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import updateMissedVisit from '@salesforce/apex/VisitController.updateMissedVisit';
import { getRecord } from 'lightning/uiRecordApi';
import USER_ID from '@salesforce/user/Id';
import NAME_FIELD from '@salesforce/schema/User.Name';

export default class VisitList extends LightningElement {
    @track visits = [];
    @track error;
    @track isLoading = true;
    @track selectedVisit;
    wiredVisitResult;
    showCheckinDetails = false;
    showOverallSummary = false;
    showLastVisit = false;
    showCurrentVisit = false;
    showChecklist = false;
    showTicketCreation = false;
    showPaymentFollowup = false;
    showOutStandingCreation = false;
    
    @track showStockCreation = false;
    @track showInvoiceCreation = false;
    @track showCompetitorCreation = false;

    showCameraInterface = false;
    imageUrl;
    stream = null;
    videoElement;
    isFrontCamera = false;
    capturedPhotoData = null; // To store the photo data until checkout

    visitComments = '';

    showMissedModal = false;
    rescheduleDate = '';
    missedReason = '';

    @track hideList = false;
    @track isUploading = false;
    @track showUploadSuccess = false;

    @track isCheckingOut = false;

    @track fileData = null;

    @track currentUser;
    userId = USER_ID;

    @wire(getRecord, { recordId: '$userId', fields: [NAME_FIELD] })
    wireuser({ error, data }) {
        if (data) {
            this.currentUser = data.fields.Name.value;
            console.log('Current User: ', this.currentUser);
        } else if (error) {
            console.error('Error loading user:', error);
        }
    }

    @wire(getVisits)
    wiredVisits(result) {
        this.wiredVisitResult = result;
        
        if (result.data) {
            this.visits = result.data.map(visit => {
                const customerName = visit.Customer__r ? visit.Customer__r.Name : 'No Name';
                
                return {
                    Id: visit.Id,
                    Name: visit.Name,
                    Status__c: visit.Status__c,
                    Visit_for__c: visit.Visit_for__c,
                    Planned_start_Date__c: visit.Planned_start_Date__c,
                    Customer__c: visit.Customer__c,
                    Customer__r: {
                        Name: customerName
                    },
                    styleClass: this.computeVisitItemClass(visit.Status__c),
                    isMissed: visit.Status__c === 'Missed',
                    Actual_start_Time__c: visit.Actual_start_Time__c ? visit.Actual_start_Time__c : null,
                    Actual_End_Time__c: visit.Actual_End_Time__c ? visit.Actual_End_Time__c : null,
                    plannedDateFormatted: this.formatDate(visit.Planned_Date__c),
                    isCompleted: visit.Status__c === 'Completed'
                };
            });
            
            this.error = undefined;
            console.log('Processed Visits:', JSON.stringify(this.visits));
        } else if (result.error) {
            this.error = result.error;
            this.visits = [];
            console.error('Error fetching visits:', result.error);
        }
        this.isLoading = false;
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: '2-digit'
        }).format(date);
    }

    connectedCallback() {
        this.currentAccountId = this.recordId;
        // Optional: Load saved preference
        const savedPreference = localStorage.getItem('hideListPreference');
        if (savedPreference !== null) {
            this.hideList = savedPreference === 'true';
        }
    }

    handleVisitClick(event) {
        const visitId = event.currentTarget.dataset.id;
        const selectedVisit = this.visits.find(visit => visit.Id === visitId);

        // If visit is completed, do nothing
        if (selectedVisit.Status__c === 'Completed') {
            return;
        }

        this.selectedVisit = selectedVisit;

        // If actual start time exists, show summary screen
        if (selectedVisit.Actual_start_Time__c) {
            this.showCheckinDetails = true;
        } else {
            // If no actual start time, show check-in screen
            this.showCheckinDetails = false;
        }
    }

    handleBack() {
        this.selectedVisit = null;
        return refreshApex(this.wiredVisitResult);
    }

    handleCheckin(event) {
        event.stopPropagation();
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const latitude = String(position.coords.latitude);
                    const longitude = String(position.coords.longitude);
                    
                    // Get current time in IST
                    const istTime = this.getISTTime();
                    
                    updateVisitCheckin({ 
                        visitId: this.selectedVisit.Id,
                        latitude: latitude,
                        longitude: longitude,
                        checkinTime: istTime
                    })
                    .then(() => {
                        this.showCheckinDetails = true;
                        this.selectedVisit.Status__c = 'InProgress';
                        this.selectedVisit.Actual_start_Time__c = new Date().toISOString(); // Update local state
                        this.dispatchEvent(
                            new ShowToastEvent({
                                title: 'Success',
                                message: 'Successfully checked in at ' + this.formatTimeForDisplay(istTime),
                                variant: 'success'
                            })
                        );
                        
                        return refreshApex(this.wiredVisitResult);
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        this.error = error.body?.message || 'Failed to update visit.';
                    });
                },
                (error) => {
                    this.error = 'Error getting location. Please enable location services.';
                }
            );
        }
    }

    handleMissed() {
        this.showMissedModal = true;
    }

    handleMissedCancel() {
        this.showMissedModal = false;
        this.resetMissedForm();
    }

    handleRescheduleDateChange(event) {
        console.log('Date changed:', event.target.value);
        this.rescheduleDate = event.target.value;
    }

    handleMissedReasonChange(event) {
        console.log('Reason changed:', event.target.value);
        this.missedReason = event.target.value;
    }

    resetMissedForm() {
        this.rescheduleDate = '';
        this.missedReason = '';
    }

    handleMissedSave() {
        console.log('Save clicked:', { 
            rescheduleDate: this.rescheduleDate, 
            missedReason: this.missedReason 
        });

        if (!this.rescheduleDate || !this.missedReason) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Please fill in all required fields',
                    variant: 'error'
                })
            );
            return;
        }

        updateMissedVisit({
            visitId: this.selectedVisit.Id,
            rescheduleDate: this.rescheduleDate,
            missedReason: this.missedReason
        })
        .then(() => {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Visit marked as missed and rescheduled',
                    variant: 'success'
                })
            );
            
            // Update local state
            this.selectedVisit.Status__c = 'Missed';
            
            // Reset form and close modal
            this.showMissedModal = false;
            this.resetMissedForm();
            this.selectedVisit = null;
            
            // Refresh the visit list
            return refreshApex(this.wiredVisitResult);
        })
        .catch(error => {
            console.error('Error updating visit:', error);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Error updating visit',
                    variant: 'error'
                })
            );
        });
    }

    toggleOverallSummary() {
        this.showOverallSummary = !this.showOverallSummary;
    }

    toggleLastVisit() {
        this.showLastVisit = !this.showLastVisit;
    }

    toggleCurrentVisit() {
        this.showCurrentVisit = !this.showCurrentVisit;
    }

    toggleChecklist() {
        this.showChecklist = !this.showChecklist;
    }

    get overallSummaryIcon() {
        return this.showOverallSummary ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get lastVisitIcon() {
        return this.showLastVisit ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get currentVisitIcon() {
        return this.showCurrentVisit ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get checklistIcon() {
        return this.showChecklist ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get overallSummaryClass() {
        return `accordion-content ${this.showOverallSummary ? 'show' : ''}`;
    }

    computeVisitItemClass(status) {
        let baseClass = 'visit-item';
        switch (status) {
            case 'Completed':
                return `${baseClass} status-completed`;
            case 'InProgress':
                return `${baseClass} status-in-progress`;
            case 'Planned':
                return `${baseClass} status-planned`;
            case 'Missed':
                return `${baseClass} status-missed`;
            default:
                return baseClass;
        }
    }

    handleTicketClick() {
        this.showTicketCreation = true;
    }

    handleTicketCancel() {
        this.showTicketCreation = false;
    }

    handleTicketSave(event) {
        // Handle the ticket save logic
        console.log('Ticket details:', event.detail);
        this.showTicketCreation = false;
    }

    handlePaymentFollowupClick() {
        this.showPaymentFollowup = true;
    }

    handlePaymentFollowupCancel() {
        this.showPaymentFollowup = false;
    }

    handlePaymentFollowupSave() {
        this.showPaymentFollowup = false;
        // Add any additional logic needed after save
    }

    handleStockClick() {
        this.showStockCreation = true;
    }

    handleStockCreationCancel() {
        this.showStockCreation = false;
    }

    handleStockCreationSave() {
        this.showStockCreation = false;
        // Add any refresh logic here if needed
    }

    handleInvoiceClick() {
        console.log('Invoice button clicked');
        console.log('Selected Visit:', JSON.stringify({
            visitId: this.selectedVisit.Id,
            accountId: this.selectedVisit.Customer__c,
            customerName: this.selectedVisit.Customer__r?.Name,
            fullVisit: this.selectedVisit
        }));
        
        if (!this.selectedVisit.Customer__c) {
            this.showToast('Error', 'No account associated with this visit', 'error');
            return;
        }
        
        this.showInvoiceCreation = true;
    }

    handleInvoiceCancel() {
        this.showInvoiceCreation = false;
    }

    handleInvoiceSave() {
        this.showInvoiceCreation = false;
        return refreshApex(this.wiredVisitResult);
    }

    handleCompetitorClick() {
        this.showCompetitorCreation = true;
    }

    handleCompetitorCancel() {
        this.showCompetitorCreation = false;
    }

    handleCompetitorSave(event) {
        console.log('Saved Competitor Data:', event.detail);
        this.showCompetitorCreation = false;
        this.showToast('Success', 'Competitor record saved successfully', 'success');
    }


    handleOutStandingClick() {
        this.showOutStandingCreation = true;
    }
    handleOutStandingCancel() {
        console.log('Cancel event received');
        this.showOutStandingCreation = false;
    }

    handleTakePhoto() {
        this.showCameraInterface = true;
        this.startCamera();
    }

    async startCamera() {
        try {
            const constraints = {
                video: { 
                    facingMode: this.isFrontCamera ? "user" : "environment"
                }
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Wait for DOM to update
            setTimeout(() => {
                this.videoElement = this.template.querySelector('video');
                if (this.videoElement) {
                    this.videoElement.srcObject = this.stream;
                }
            }, 0);
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.error = 'Error accessing camera: ' + error.message;
        }
    }

    async handleCaptureImage() {
        const video = this.template.querySelector('video');
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        this.imageUrl = canvas.toDataURL('image/jpeg');
        const base64Data = this.imageUrl.split(',')[1];
        
        // Upload the captured image immediately
        this.isUploading = true;
        uploadFile({
            visitId: this.selectedVisit.Id,
            fileName: `store_photo_${this.selectedVisit.Id}.jpg`,
            base64Data: base64Data,
            contentType: 'image/jpeg'
        })
        .then(() => {
            this.isUploading = false;
            this.showUploadSuccess = true;
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Photo uploaded successfully',
                    variant: 'success'
                })
            );
            setTimeout(() => {
                this.showUploadSuccess = false;
            }, 3000);
        })
        .catch(error => {
            this.isUploading = false;
            console.error('Error uploading captured photo:', error);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Error uploading photo',
                    variant: 'error'
                })
            );
        });
        
        this.stopCamera();
    }

    handleSwitchCamera() {
        this.isFrontCamera = !this.isFrontCamera;
        if (this.stream) {
            this.stopCamera();
        }
        this.startCamera();
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.showCameraInterface = false;
    }

    dataURLtoBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    async uploadPhoto(blob) {
        try {
            const base64 = await this.convertToBase64(blob);
            const result = await uploadFile({
                visitId: this.selectedVisit.Id,
                fileName: 'store_photo.jpg',
                base64Data: base64.split(',')[1],
                contentType: 'image/jpeg'
            });
            console.log('File uploaded successfully');
        } catch (error) {
            console.error('Error uploading file:', error);
            this.error = 'Error uploading photo: ' + error.message;
        }
    }

    convertToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    handleCommentsChange(event) {
        console.log('Comments changed:', event.target.value); // Debug log
        this.visitComments = event.target.value;
    }

    handleFileChange(event) {
        const file = event.target.files[0];
        if (file) {
            this.isUploading = true; // Show loading spinner
            this.showUploadSuccess = false;
            
            const reader = new FileReader();
            reader.onload = () => {
                this.imageUrl = reader.result;
                this.fileData = {
                    filename: file.name || `store_photo_${this.selectedVisit.Id}_${new Date().getTime()}.jpg`,
                    base64: reader.result.split(',')[1],
                    contentType: file.type
                };

                // Upload file immediately after reading
                uploadFile({
                    visitId: this.selectedVisit.Id,
                    fileName: this.fileData.filename,
                    base64Data: this.fileData.base64,
                    contentType: this.fileData.contentType
                })
                .then(() => {
                    this.showUploadSuccess = true;
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Success',
                            message: 'Photo uploaded successfully',
                            variant: 'success'
                        })
                    );
                    
                    // Hide success message after 3 seconds
                    setTimeout(() => {
                        this.showUploadSuccess = false;
                    }, 3000);
                })
                .catch(error => {
                    console.error('Error uploading file:', error);
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Error',
                            message: error.body?.message || 'Error uploading photo',
                            variant: 'error'
                        })
                    );
                    // Reset file data on error
                    this.fileData = null;
                    this.imageUrl = null;
                })
                .finally(() => {
                    this.isUploading = false; // Hide loading spinner
                });
            };
            reader.readAsDataURL(file);
        }
    }

    handleCheckout() {
        if (!this.visitComments || this.visitComments.trim() === '') {
            this.showCommentError = true;
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Please enter comments before checking out',
                    variant: 'error'
                })
            );
            return;
        }

        if (navigator.geolocation) {
            this.isCheckingOut = true;
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const latitude = String(position.coords.latitude);
                    const longitude = String(position.coords.longitude);
                    const istTime = this.getISTTime();

                    try {
                        // First, upload the file if it exists
                        if (this.fileData) {
                            await uploadFile({
                                visitId: this.selectedVisit.Id,
                                fileName: this.fileData.filename,
                                base64Data: this.fileData.base64,
                                contentType: this.fileData.contentType
                            });
                        }

                        // Then proceed with checkout
                        await updateVisitCheckout({ 
                            visitId: this.selectedVisit.Id,
                            latitude: latitude,
                            longitude: longitude,
                            checkoutTime: istTime,
                            comments: this.visitComments
                        });

                        this.dispatchEvent(
                            new ShowToastEvent({
                                title: 'Success',
                                message: 'Successfully checked out at ' + this.formatTimeForDisplay(istTime),
                                variant: 'success'
                            })
                        );

                        // Reset states
                        this.visitComments = '';
                        this.imageUrl = null;
                        this.fileData = null;
                        this.selectedVisit = null;
                        this.showCheckinDetails = false;

                        return refreshApex(this.wiredVisitResult);
                    } catch (error) {
                        console.error('Error:', error);
                        const errorMessage = error.body?.message || 'Failed to update visit.';
                        this.dispatchEvent(
                            new ShowToastEvent({
                                title: 'Error',
                                message: errorMessage,
                                variant: 'error'
                            })
                        );
                    } finally {
                        this.isCheckingOut = false;
                    }
                },
                (error) => {
                    this.isCheckingOut = false;
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Error',
                            message: 'Error getting location. Please enable location services.',
                            variant: 'error'
                        })
                    );
                }
            );
        }
    }

    handleToggleChange(event) {
        this.hideList = event.target.checked;
        // Optional: Save preference to localStorage
        localStorage.setItem('hideListPreference', this.hideList);
    }

    // Helper method to get IST time in correct format
    getISTTime() {
        const now = new Date();
        // Convert to IST (UTC+5:30)
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
        
        // Format: YYYY-MM-DD HH:mm:ss
        return istTime.toISOString()
            .replace('T', ' ')
            .split('.')[0];
    }

    // Helper method to format time for display
    formatTimeForDisplay(dateTimeString) {
        const date = new Date(dateTimeString);
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });
    }

    handleBackToVisit() {
        this.showCheckinDetails = false;
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

    handleRetake() {
        this.imageUrl = null;
        this.capturedPhotoData = null;
        this.startCamera();
    }

    handleRemovePhoto() {
        this.imageUrl = null;
        this.fileData = null;
    }

    handleConfirmPhoto() {
        this.showCameraInterface = false;
        // The photo is already stored in this.capturedPhotoData
        // It will be uploaded during checkout
    }

    handleCaptureClick(event) {
        event.preventDefault();
        this.template.querySelector('.file-input').click();
    }

    get showCheckinButton() {
        return this.selectedVisit && 
               !this.selectedVisit.Actual_start_Time__c && 
               this.selectedVisit.Status__c !== 'Completed' &&
               this.selectedVisit.Status__c !== 'Missed';
    }
}