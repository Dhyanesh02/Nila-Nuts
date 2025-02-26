import { LightningElement, track, api } from 'lwc';
import getVisitOwners from '@salesforce/apex/TeamVisitController.getVisitOwners';
import getTeamVisitDetails from '@salesforce/apex/TeamVisitController.getTeamVisitDetails';

export default class MyTeamVisit extends LightningElement {
    @track selectedDate = new Date().toISOString().split('T')[0];
    @track selectedOwner;
    @track visits = [];
    @track ownerOptions = [];
    @track selectedVisit;
    @track showMap = false;
    @track isLoading = false;

    completedVisits = 0;
    plannedVisits = 0;
    missedVisits = 0;
    daExpense = 0;
    otherExpense = 0;

    mapMarkers = [];
    mapCenter = {
        location: {
            Latitude: 20.5937, // Default center for India
            Longitude: 78.9629
        }
    };
    zoomLevel = 5;

    // Debounce timer
    mapUpdateTimer;

    // Cache for visit markers
    visitMarkersCache = new Map();

    connectedCallback() {
        this.loadOwners();
    }

    get totalExpense() {
        return this.daExpense + this.otherExpense;
    }

    get completedVisits() {
        return this.visits.filter(visit => visit.Status__c === 'Completed').length;
    }

    get inProgressVisits() {
        return this.visits.filter(visit => visit.Status__c === 'InProgress').length;
    }

    get plannedVisits() {
        return this.visits.filter(visit => visit.Status__c === 'Planned').length;
    }

    get missedVisits() {
        return this.visits.filter(visit => visit.Status__c === 'Missed').length;
    }

    handleDateChange(event) {
        this.selectedDate = event.target.value;
        this.loadVisits();
    }

    handleOwnerChange(event) {
        this.selectedOwner = event.target.value;
        this.loadVisits();
    }

    handleVisitClick(event) {
        const visitId = event.currentTarget.dataset.id;
        const visit = this.visits.find(v => v.Id === visitId);
        
        if (visit) {
            this.selectedVisit = visit;
            this.updateMapMarkers(visit);
        }
    }

    updateMapMarkers(visit) {
        this.mapMarkers = [];
        
        if (visit.Checkin_Latitude__c && visit.Checkin_Longitude__c) {
            this.mapMarkers.push({
                location: {
                    Latitude: visit.Checkin_Latitude__c,
                    Longitude: visit.Checkin_Longitude__c
                },
                title: `${visit.Customer__r.Name} - Check-in`,
                description: `Time: ${this.formatDateTime(visit.Actual_start_Time__c)}`,
                icon: 'standard:visit'
            });
        }

        if (visit.Checkout_Latitude__c && visit.Checkout_Longitude__c) {
            this.mapMarkers.push({
                location: {
                    Latitude: visit.Checkout_Latitude__c,
                    Longitude: visit.Checkout_Longitude__c
                },
                title: `${visit.Customer__r.Name} - Check-out`,
                description: `Time: ${this.formatDateTime(visit.Actual_start_Time_c__c)}`,
                icon: 'standard:visit'
            });
        }

        if (this.mapMarkers.length > 0) {
            this.mapCenter = {
                location: {
                    Latitude: this.mapMarkers[0].location.Latitude,
                    Longitude: this.mapMarkers[0].location.Longitude
                }
            };
            this.zoomLevel = 15;
        }
    }

    loadOwners() {
        getVisitOwners()
            .then(result => {
                this.ownerOptions = result.map(owner => ({
                    label: owner.Name,
                    value: owner.Id
                }));
                if (this.ownerOptions.length > 0) {
                    this.selectedOwner = this.ownerOptions[0].value;
                    this.loadVisits();
                }
            })
            .catch(error => {
                console.error('Error loading owners:', error);
            });
    }

    loadVisits() {
        if (!this.selectedDate || !this.selectedOwner) return;
        
        this.isLoading = true;
        this.showMap = false; // Hide map while loading new visits
        
        getTeamVisitDetails({ 
            selectedDate: this.selectedDate, 
            ownerId: this.selectedOwner 
        })
        .then(result => {
            this.visits = result.visits.map(visit => ({
                ...visit,
                statusClass: `visit-${visit.Status__c.toLowerCase()}`,
                checkInTime: this.formatDateTime(visit.Actual_start_Time__c),
                checkOutTime: this.formatDateTime(visit.Actual_start_Time_c__c)
            }));

            this.completedVisits = result.completedVisits;
            this.plannedVisits = result.plannedVisits;
            this.missedVisits = result.missedVisits;
            this.daExpense = result.daExpense;
            this.otherExpense = result.otherExpense;
            
            // Reset map when loading new visits
            this.selectedVisit = null;
        })
        .catch(error => {
            console.error('Error loading visits:', error);
        })
        .finally(() => {
            this.isLoading = false;
        });
    }

    formatDateTime(dateTimeStr) {
        if (!dateTimeStr) return '';
        const dt = new Date(dateTimeStr);
        return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    renderedCallback() {
        if (this.showMap) {
            this.updateMapMarkers();
        }
    }
}