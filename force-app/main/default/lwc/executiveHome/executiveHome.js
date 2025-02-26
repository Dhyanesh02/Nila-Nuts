import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import NILA_LOGO from '@salesforce/resourceUrl/Nila_logo';
// Import Apex methods
import createDailyFieldActivity from '@salesforce/apex/DailyFieldActivityController.createDailyFieldActivity';
import updateDailyFieldActivity from '@salesforce/apex/DailyFieldActivityController.updateDailyFieldActivity';
import uploadFile from '@salesforce/apex/DailyFieldActivityController.uploadFile';
import getCurrentActivity from '@salesforce/apex/DailyFieldActivityController.getCurrentActivity';
// Import Exif.js from Salesforce static resources
import EXIF_JS from '@salesforce/resourceUrl/exif_js';
import { loadScript } from 'lightning/platformResourceLoader';
import getVisits from '@salesforce/apex/VisitController.getVisits';
import { refreshApex } from '@salesforce/apex';

export default class ExecutiveHome extends NavigationMixin(LightningElement) {
    // Logo URL
    logo = NILA_LOGO;
    
    @track showMainMenu =true;
    // ODO form properties
    @track showOdoForm = false;
    @track dayStarted = false;
    odoValue;
    workingWith = 'None';
    @track activityId;
    @track imageUrl;
    @track isLoading = false;
    @track showEndOdoModal = false;
    @track endOdoValue;
    @track isImageLoading = false;
    @track endImageUrl;
    @track endImageFile;
    @track isEndImageLoading = false;
    @track incompleteVisits = [];
    @track showMarkMissedModal = false;
    @track isPageLoading = true;
    @track showRefreshAnimation = false;

    // ODO form handlers
    handleStartDay() {
        this.showOdoForm = true;
    }

    handleOdoChange(event) {
        this.odoValue = event.target.value;
    }

    handleWorkingWithChange(event) {
        this.workingWith = event.target.value;
    }

    async handleImageUpload(event) {
        const file = event.target.files[0];
        
        // Check if it's an image
        if (!file.type.startsWith('image/')) {
            this.showToast('Error', 'Please capture an image using camera', 'error');
            event.target.value = '';
            return;
        }

        // Check if image was just taken (within last minute)
        const imageTimestamp = file.lastModified;
        const currentTime = Date.now();
        const oneMinute = 60 * 1000; // milliseconds
        
        if ((currentTime - imageTimestamp) > oneMinute) {
            this.showToast('Error', 'Please capture a new image using camera', 'error');
            event.target.value = '';
            return;
        }
        
        this.isImageLoading = true;
        try {
            this.imageFile = file;
            await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    this.imageUrl = reader.result;
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        } catch (error) {
            this.showToast('Error', 'Failed to process image', 'error');
        } finally {
            this.isImageLoading = false;
        }
    }

    readExifData(file) {
        return new Promise((resolve) => {
            EXIF.getData(file, function() {
                const allExif = EXIF.getAllTags(this);
                resolve(allExif);
            });
        });
    }

    openCamera() {
        const input = this.template.querySelector('[data-id="fileInput"]');
        if(input) input.click();
    }
    
    @wire(getCurrentActivity)
    wiredActivity(result) {
        this.wiredActivityResult = result;
        const { error, data } = result;
        if (data) {
            this.activityId = data.Id;
            this.dayStarted = !data.Check__c;
            this.showOdoForm = false;
            console.log('Current Activity:', data);
            console.log('Day Started:', this.dayStarted);
        } else if (error) {
            if (error.body && error.body.message !== 'List has no rows for assignment to SObject') {
                this.showToast('Error', 'Error fetching activity status', 'error');
                console.error('Error fetching activity:', error);
            }
            this.dayStarted = false;
            this.activityId = null;
            this.showOdoForm = false;
        }
    }

    async handleSubmit() {
        try {
            if (!this.odoValue || this.workingWith === 'None' || !this.imageFile) {
                this.showToast('Error', 'Please fill all fields and upload ODO meter image', 'error');
                return;
            }

            this.isLoading = true;
            
            // Create Daily Field Activity record
            const activity = await createDailyFieldActivity({
                odometerStart: this.odoValue,
                workingWith: this.workingWith,
                startDateTime: new Date().toISOString()
            });
            
            this.activityId = activity.Id;

            // Upload image
            await uploadFile({
                recordId: this.activityId,
                fileData: await this.readFileAsBase64(this.imageFile),
                fileName: 'ODOMeter_Start.jpg'
            });

            this.showToast('Success', 'Day started successfully', 'success');
            this.showOdoForm = false;
            this.dayStarted = true;  // Set day started to true after successful creation
            
        } catch (error) {
            console.error('Submit error:', error);
            this.showToast('Error', error.body?.message || 'Handle Submit Button Error', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleEndDay() {
        try {
            const visits = await getVisits();
            console.log('Fetched visits:', visits);
            
            if (visits && Array.isArray(visits)) {
                const incompleteVisits = visits.filter(visit => 
                    visit.Status__c !== 'Completed' && visit.Status__c !== 'Missed'
                );
                
                console.log('Incomplete visits:', incompleteVisits);
                
                if (incompleteVisits.length > 0) {
                    this.incompleteVisits = incompleteVisits;
                    this.showMarkMissedModal = true;
                    this.showEndOdoModal = false;  // Make sure to hide the end odo modal
                    console.log('Setting showMarkMissedModal to true');
                } else {
                    this.showMarkMissedModal = false;
                    this.showEndOdoModal = true;
                }
            }
        } catch (error) {
            console.error('Error in handleEndDay:', error);
            this.showToast('Error', 'Failed to check visits status', 'error');
        }
    }

    handleEndOdoChange(event) {
        this.endOdoValue = event.target.value;
    }

    handleEndImageUpload(event) {
        const file = event.target.files[0];
        
        // Check if it's an image
        if (!file.type.startsWith('image/')) {
            this.showToast('Error', 'Please capture an image using camera', 'error');
            event.target.value = '';
            return;
        }

        // Check if image was just taken (within last minute)
        const imageTimestamp = file.lastModified;
        const currentTime = Date.now();
        const oneMinute = 60 * 1000;
        
        if ((currentTime - imageTimestamp) > oneMinute) {
            this.showToast('Error', 'Please capture a new image using camera', 'error');
            event.target.value = '';
            return;
        }
        
        this.isEndImageLoading = true;
        try {
            this.endImageFile = file;
            const reader = new FileReader();
            reader.onload = () => {
                this.endImageUrl = reader.result;
            };
            reader.readAsDataURL(file);
        } catch (error) {
            this.showToast('Error', 'Failed to process image', 'error');
        } finally {
            this.isEndImageLoading = false;
        }
    }

    async handleEndOdoSubmit() {
        try {
            if (!this.endOdoValue || !this.endImageFile) {
                this.showToast('Error', 'Please enter ODO reading and capture image', 'error');
                return;
            }
            
            this.isLoading = true;
            
            await updateDailyFieldActivity({
                recordId: this.activityId,
                odometerEnd: this.endOdoValue,
                endDateTime: new Date().toISOString(),
                fileData: await this.readFileAsBase64(this.endImageFile)
            });

            this.showToast('Success', 'Day ended successfully', 'success');
            this.showEndOdoModal = false;
            this.dayStarted = false;  // Set day started to false after successful end
            this.resetForm();
            
        } catch (error) {
            console.error('End day error:', error);
            this.showToast('Error', error.body?.message || 'Failed to end day', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleCancelEndOdo() {
        this.showEndOdoModal = false;
        this.endOdoValue = null;
    }

    handleCancelMarkMissed() {
        this.showMarkMissedModal = false;
        this.incompleteVisits = [];
    }

    // Helper methods
    async readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }

    resetForm() {
        this.dayStarted = false;
        this.odoValue = '';
        this.workingWith = 'None';
        this.imageUrl = null;
        this.imageFile = null;
        this.activityId = null;
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

    // Add this getter
    get submitButtonLabel() {
        return this.isLoading ? 'Processing...' : 'Submit';
    }

    renderedCallback() {
        if (this.exifJsInitialized) {
            return;
        }
        this.exifJsInitialized = true;
        loadScript(this, EXIF_JS)
            .then(() => {
                console.log('EXIF library loaded');
            })
            .catch(error => {
                this.showToast('Error', 'Failed to load EXIF library', 'error');
            });
    }

    // Add this getter
    get captureButtonLabel() {
        return this.imageUrl ? 'Retake Image' : 'Capture ODO Image';
    }

    get endCaptureButtonLabel() {
        return this.endImageUrl ? 'Retake Image' : 'Capture End ODO Image';
    }

    connectedCallback() {
        this.handleInitialLoad();
    }

    async handleInitialLoad() {
        this.isPageLoading = true;
        try {
            await refreshApex(this.wiredActivityResult);
            await this.delay(1000); // Add small delay for smooth transition
        } finally {
            this.isPageLoading = false;
        }
    }

    async refreshPage() {
        this.showRefreshAnimation = true;
        try {
            await refreshApex(this.wiredActivityResult);
            await this.delay(2000); // Add small delay for smooth animation
        } finally {
            this.showRefreshAnimation = false;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async handleDayEnded() {
        this.dayStarted = false;
        this.showEndOdoModal = false;
        this.showMarkMissedModal = false;
        this.endOdoValue = null;
        this.endImageUrl = null;
        this.endImageFile = null;
        
        await this.refreshPage();
    }

    handleCancelStartDay() {
        this.showOdoForm = false;
        this.imageUrl = null;
        this.imageFile = null;
        this.odoValue = null;
        this.workingWith = 'None';
        this.isImageLoading = false;
    }
}