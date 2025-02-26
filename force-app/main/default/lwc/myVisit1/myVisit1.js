import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import searchLeads from '@salesforce/apex/VisitController.searchLeads';
import searchAccounts from '@salesforce/apex/VisitController.searchAccounts';
import createVisitRecord from '@salesforce/apex/VisitController.createVisitRecord';
import getVisits from '@salesforce/apex/VisitController.getVisits';
import { refreshApex } from '@salesforce/apex';
import getCurrentActivity from '@salesforce/apex/DailyFieldActivityController.getCurrentActivity';
import updateDailyFieldActivity from '@salesforce/apex/DailyFieldActivityController.updateDailyFieldActivity';
import updateMissedVisit from '@salesforce/apex/VisitController.updateMissedVisit';

export default class MyVisit1 extends NavigationMixin(LightningElement) {
    @track showVisitModal = false;
    @track visitType = '';
    @track selectedRecordId = '';
    @track selectedRecordName = '';
    @track searchResults = [];
    @track showSearchResults = false;
    @track visitTime = null;
    searchTerm = '';
    visitCounts = {
        planned: 0,
        completed: 0,
        inProgress: 0,
        missed: 0,
        total: 0,
        offline: 0
    };
    selectedDate;
    wiredVisitResult; // Store the wired result for refresh
    searchTimeout;
    @track showEndOdoModal = false;
    @track endOdoValue;
    @track endImageUrl;
    @track endImageFile;
    @track isEndImageLoading = false;
    @track isLoading = false;
    @track showEndButton = false;
    activityId;
    @track showMarkMissedModal = false;
    @track incompleteVisits = [];
    @track showWarningNotification = false;

    get defaultDate() {
        return new Date().toISOString().split('T')[0];
    }

    get minDate() {
        return this.defaultDate;
    }

    get defaultDateTime() {
        return new Date().toISOString().split('T')[0];
    }

    get showLookup() {
        return this.visitType !== '';
    }

    get lookupLabel() {
        return `Select ${this.visitType}`;
    }

    get searchPlaceholder() {
        return `Search ${this.visitType}...`;
    }

    handleVisitClick() {
        this.showVisitModal = true;
    }

    handleCancel() {
        this.resetForm();
    }

    handleVisitTypeChange(event) {
        this.visitType = event.target.value;
        this.selectedRecordId = '';
        this.selectedRecordName = '';
        this.searchResults = [];
        this.showSearchResults = false;
    }

    handleRemoveSelection() {
        this.selectedRecordId = '';
        this.selectedRecordName = '';
        this.searchResults = [];
    }

    handleSearch(event) {
        clearTimeout(this.searchTimeout);
        const searchTerm = event.target.value;
        
        // Don't hide results while typing
        if (searchTerm) {
            this.showSearchResults = true;
        }

        // Debounce the search
        this.searchTimeout = setTimeout(() => {
            if (searchTerm) {
                searchAccounts({ searchTerm: searchTerm })
                    .then(results => {
                        this.searchResults = results;
                        this.showSearchResults = true;
                    })
                    .catch(error => {
                        console.error('Error searching accounts:', error);
                    });
            } else {
                this.searchResults = [];
                this.showSearchResults = false;
            }
        }, 300);
    }

    handleInputBlur() {
        // Use setTimeout to allow click events on results to fire first
        setTimeout(() => {
            this.showSearchResults = false;
        }, 300);
    }

    handleRecordSelection(event) {
        this.selectedRecordId = event.currentTarget.dataset.id;
        this.selectedRecordName = event.currentTarget.dataset.name;
        this.showSearchResults = false;
    }

    handleDateChange(event) {
        this.selectedDate = event.target.value;
    }

    handleCreateVisit() {
        // Get the select element for visit type
        const visitTypeSelect = this.template.querySelector('select');
        const selectedType = visitTypeSelect.value;

        // Get the selected record
        const selectedRecord = this.selectedRecordId;

        // Check if both fields are filled
        if (!selectedType || !selectedRecord) {
            // Show error message
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Please fill in all required fields',
                    variant: 'error'
                })
            );
            
            // Add visual indication for required fields
            if (!selectedType) {
                visitTypeSelect.classList.add('slds-has-error');
            }
            if (!selectedRecord) {
                this.template.querySelector('.slds-combobox').classList.add('slds-has-error');
            }
            return;
        }

        // If validation passes, proceed with visit creation
        // If no date selected, use today's date
        const visitDate = this.selectedDate || this.defaultDateTime;
        
        createVisitRecord({
            visitFor: this.visitType,
            recordId: this.selectedRecordId,
            visitDate: visitDate
        })
        .then(() => {
            // Success handling
            this.showToast('Success', 'Visit created successfully', 'success');
            this.resetForm();
            return refreshApex(this.wiredVisitResult);
        })
        .catch(error => {
            console.error('Error creating visit:', error);
            this.showToast('Error', 'Failed to create visit', 'error');
        });
    }

    validateForm() {
        if (!this.visitType || !this.selectedRecordId || !this.selectedDate) {
            this.showToast('Error', 'Please fill in all required fields', 'error');
            return false;
        }
        return true;
    }

    resetForm() {
        this.showVisitModal = false;
        this.visitType = '';
        this.selectedRecordId = '';
        this.selectedRecordName = '';
        this.searchResults = [];
        this.showSearchResults = false;
        this.selectedDate = '';
        this.endOdoValue = null;
        this.endImageUrl = null;
        this.endImageFile = null;
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

    @wire(getVisits)
    wiredVisits(result) {
        this.wiredVisitResult = result; // Store the wire result
        const { data, error } = result;
        if (data) {
            // Reset counts
            this.visitCounts = {
                planned: 0,
                completed: 0,
                inProgress: 0,
                missed: 0,
                total: data.length,
                offline: 0
            };

            // Count visits by status
            data.forEach(visit => {
                switch(visit.Status__c) {
                    case 'Planned':
                        this.visitCounts.planned++;
                        break;
                    case 'Completed':
                        this.visitCounts.completed++;
                        break;
                    case 'InProgress':
                        this.visitCounts.inProgress++;
                        break;
                    case 'Missed':
                        this.visitCounts.missed++;
                        break;
                }
            });

            console.log('Visit counts:', this.visitCounts);
        } else if (error) {
            console.error('Error fetching visits:', error);
        }
    }

    @wire(getCurrentActivity)
    wiredActivity({ error, data }) {
        if (data) {
            this.activityId = data.Id;
            this.showEndButton = !data.Check__c;
            console.log('Current Activity in MyVisit:', data);
        } else if (error) {
            console.error('Error fetching activity:', error);
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
                    this.showWarningNotification = true;
                } else {
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
        
        if (!file.type.startsWith('image/')) {
            this.showToast('Error', 'Please capture an image using camera', 'error');
            event.target.value = '';
            return;
        }

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

            if (!this.activityId) {
                this.showToast('Error', 'No active day found', 'error');
                return;
            }
            
            this.isLoading = true;
            
            const fileData = await this.readFileAsBase64(this.endImageFile);
            
            await updateDailyFieldActivity({
                recordId: this.activityId,
                odometerEnd: this.endOdoValue,
                endDateTime: new Date().toISOString(),
                fileData: fileData
            });

            this.showToast('Success', 'Day ended successfully', 'success');
            this.showEndOdoModal = false;
            this.showEndButton = false;
            this.resetForm();
            
            // Dispatch event to notify parent components
            this.dispatchEvent(new CustomEvent('dayended', {
                bubbles: true,
                composed: true
            }));

            // Navigate to Executive Home page
            this[NavigationMixin.Navigate]({
                type: 'standard__navItemPage',
                attributes: {
                    apiName: 'Executive_Home'
                }
            });
            
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
        this.endImageUrl = null;
        this.endImageFile = null;
    }

    async readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }

    get submitButtonLabel() {
        return this.isLoading ? 'Processing...' : 'Submit';
    }

    get captureButtonLabel() {
        return this.endImageUrl ? 'Retake Image' : 'Capture End ODO Image';
    }

    handleMarkAllMissed() {
        const promises = this.incompleteVisits.map(visit => {
            return updateMissedVisit({
                visitId: visit.Id,
                rescheduleDate: this.getTomorrowDate(),
                missedReason: 'Marked as missed during day end'
            });
        });

        Promise.all(promises)
            .then(() => {
                this.showToast('Success', 'All remaining visits marked as missed', 'success');
                this.showWarningNotification = false;
                this.showEndOdoModal = true;
                return refreshApex(this.wiredVisitResult);
            })
            .catch(error => {
                this.showToast('Error', 'Failed to mark visits as missed', 'error');
                console.error('Error:', error);
            });
    }

    getTomorrowDate() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }

    handleCloseWarning() {
        this.showWarningNotification = false;
        this.incompleteVisits = [];
    }
}