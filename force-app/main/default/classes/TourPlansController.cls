/**
* @File Name : TourPlansController.cls
* @Description :
* @Author :
* @Last Modified By :
* @Last Modified On : February 6, 2025
* @Modification Log :
*==============================================================================
* Ver | Date | Author | Modification
*==============================================================================
* 1.0 | February 6, 2025 |   | Initial Version
**/

public with sharing class TourPlansController {
    
    @AuraEnabled(cacheable=true)
   public static List<Tour_Plans__c> getTourPlans(String tourPlanId) {
       try {
           return [
               SELECT Id, Name, Beat_Name__c, Start_Date__c, End_Date__c, 
                      Approval_Status__c, CreatedById, CreatedBy.Name,
                      LastModifiedById, LastModifiedBy.Name, OwnerId, Owner.Name,
                      CreatedDate, LastModifiedDate
               FROM Tour_Plans__c
               WHERE Id = :tourPlanId
               LIMIT 1
           ];
           
       } catch (Exception e) {
           throw new AuraHandledException('Error retrieving Tour Plan: ' + e.getMessage());
       }
   }
   
   @AuraEnabled(cacheable=true)
   public static List<Account> getAccounts(String searchKey) {
       try {
           String key = '%' + searchKey + '%';
           return [
               SELECT Id, Name  // Simplified fields for now
               FROM Account 
               WHERE Name LIKE :key 
               ORDER BY Name ASC
               LIMIT 10
           ];
       } catch (Exception e) {
           throw new AuraHandledException(e.getMessage());
       }
   }


   @AuraEnabled(cacheable=true)
   public static List<String> getVisitTypes() {
       Schema.DescribeFieldResult fieldResult = Account.Type.getDescribe();
       List<Schema.PicklistEntry> picklistValues = fieldResult.getPicklistValues();
       List<String> visitTypes = new List<String>();
       
       for(Schema.PicklistEntry entry : picklistValues) {
           visitTypes.add(entry.getValue());
       }
       return visitTypes;
   }

  


   @AuraEnabled(cacheable=true)
   public static List<CustomerVisitWrapper> getTodayVisitsByType(String visitType) {
       
       
       Date today = Date.today();
       
       // Get all visits for today of the specified type
       List<Visit__c> visits = [
           SELECT Id, 
                  Customer__c,
                  Customer__r.Name,
                  Customer__r.BillingCity,
                  Customer__r.Owner.Name,
                  Visit_for__c
           FROM Visit__c 
           WHERE Planned_start_Date__c = :today 
           AND Visit_for__c = :visitType
       ];
       
       // Group visits by customer
       Map<Id, CustomerVisitWrapper> customerMap = new Map<Id, CustomerVisitWrapper>();
       
       for(Visit__c visit : visits) {
           if(!customerMap.containsKey(visit.Customer__c)) {
               customerMap.put(visit.Customer__c, new CustomerVisitWrapper(
                   visit.Customer__r.Name,
                   visit.Customer__r.BillingCity,
                   visit.Customer__r.Owner.Name
               ));
           }
           customerMap.get(visit.Customer__c).visitCount++;
       }
       
       return customerMap.values();
   }

   public class CustomerVisitWrapper {
       @AuraEnabled public String customerName;
       @AuraEnabled public String city;
       @AuraEnabled public String ownerName;
       @AuraEnabled public Integer visitCount = 0;
       
       public CustomerVisitWrapper(String customerName, String city, String ownerName) {
           this.customerName = customerName;
           this.city = city;
           this.ownerName = ownerName;
       }
   }

   @AuraEnabled(cacheable=true)
   public static List<Account> getAccountsByType(String visitType) {
       try {
           // Query accounts based on visit type
           // Assuming you have a custom field on Account to store visit type
           // Replace 'Visit_Type__c' with your actual field name
           return [
               SELECT Id, Name, BillingCity, Owner.Name
               FROM Account 
               WHERE Type = :visitType
               ORDER BY Name ASC
               LIMIT 10
           ];
       } catch (Exception e) {
           throw new AuraHandledException('Error fetching accounts: ' + e.getMessage());
       }
   }
   @AuraEnabled
   public static void createVisits(List<Map<String, String>> visits, String tourPlanId) {
       try {
           // First get the Tour Plan owner
           Tour_Plans__c tourPlan = [SELECT Id, OwnerId FROM Tour_Plans__c WHERE Id = :tourPlanId LIMIT 1];
           Id visitOwnerId = tourPlan.OwnerId;
           
           List<Visit__c> newVisits = new List<Visit__c>();
           
           // Query Account IDs based on names
           Set<String> accountNames = new Set<String>();
           for(Map<String, String> visit : visits) {
               accountNames.add(visit.get('customerName'));
           }
           
           Map<String, Id> accountNameToId = new Map<String, Id>();
           for(Account acc : [SELECT Id, Name FROM Account WHERE Name IN :accountNames]) {
               accountNameToId.put(acc.Name, acc.Id);
           }
           
           for(Map<String, String> visit : visits) {
               String customerName = visit.get('customerName');
               Id accountId = accountNameToId.get(customerName);
               
               if(accountId != null) {
                   Visit__c newVisit = new Visit__c(
                       Customer__c = accountId,
                       Visit_for__c = visit.get('visitType'),
                       Planned_start_Date__c = Date.valueOf(visit.get('plannedDate')),
                       Status__c = 'Planned',
                       OwnerId = visitOwnerId  // Use Tour Plan owner instead of current user
                   );
                   newVisits.add(newVisit);
               }
           }
           
           if(!newVisits.isEmpty()) {
               insert newVisits;
           } else {
               throw new AuraHandledException('No valid accounts found for creating visits');
           }
       } catch(Exception e) {
           throw new AuraHandledException('Error creating visits: ' + e.getMessage());
       }
   }

   @AuraEnabled(cacheable=true)
public static List<Visit__c> getVisitsForCalendar(Date startDate, Date endDate, Id tourPlanOwnerId) {
   try {
       return [
           SELECT Id, 
                  Customer__r.Name,
                  Planned_start_Date__c,
                  Visit_for__c,
                  Status__c,
                  OwnerId
           FROM Visit__c 
           WHERE OwnerId = :tourPlanOwnerId  // Filter by Tour Plan owner
           AND Planned_start_Date__c >= :startDate
           AND Planned_start_Date__c <= :endDate
           ORDER BY Planned_start_Date__c ASC
       ];
   } catch (Exception e) {
       throw new AuraHandledException(e.getMessage());
   }
}
   
   @AuraEnabled(cacheable=true)
   public static List<Visit__c> getVisitsForDate(Date selectedDate, Id tourPlanOwnerId) {
       try {
           return [
               SELECT Id,
                      Name,
                      Customer__r.Name,
                      Planned_start_Date__c,
                      Visit_for__c,
                      Status__c,
                      OwnerId
               FROM Visit__c 
               WHERE OwnerId = :tourPlanOwnerId  // Filter by Tour Plan owner
               AND Planned_start_Date__c = :selectedDate
               ORDER BY Planned_start_Date__c ASC
           ];
       } catch (Exception e) {
           throw new AuraHandledException(e.getMessage());
       }
   }
   
}